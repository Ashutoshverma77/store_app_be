import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Connection, isValidObjectId } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Receiving } from './schema/item-receive.schema';
import { StoreItem } from '../store-item/schema/store-item.schema';
import { StockMovement } from './schema/stock-movement.schema';
import { StorePlaceItemQuantity } from '../store-place/schema/store-place-item-quantity.schema';
import { StorePlace } from '../store-place/schema/store-place.schema';

@Injectable()
export class ReceivingService {
  private readonly logger = new Logger(ReceivingService.name);

  constructor(
    @InjectModel(Receiving.name, 'store')
    private readonly recModel: Model<Receiving>,
    @InjectModel(StoreItem.name, 'store')
    private readonly itemModel: Model<StoreItem>,
    @InjectModel(StorePlace.name, 'store')
    private readonly placeModel: Model<StorePlace>,
    @InjectModel(StockMovement.name, 'store')
    private readonly movModel: Model<StockMovement>,
    @InjectModel(StorePlaceItemQuantity.name, 'store')
    private readonly spiqModel: Model<StorePlaceItemQuantity>,
  ) {}
  private toInt(v: any): number {
    const n = Number.parseInt(String(v ?? '0'), 10);
    return Number.isFinite(n) && !Number.isNaN(n) ? n : 0;
  }
  private toStr(n: number): string {
    return String(Math.max(0, n | 0));
  }
  private async nextRecNo(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.recModel.countDocuments();
    return `RCV-${year}-${String(seq + 1).padStart(5, '0')}`;
  }

  async create(dto: any) {
    this.logger.debug(`Create payload: ${JSON.stringify(dto)}`);

    // Basic payload checks (keep return shape)
    if (!dto || !Array.isArray(dto.lines) || dto.lines.length === 0) {
      return { msg: 'Receive Item Failed.......', status: false };
    }
    if (!dto.userId || !isValidObjectId(dto.userId)) {
      return { msg: 'Receive Item Failed.......', status: false };
    }

    // Normalize + validate + merge duplicates
    const merged = new Map<
      string,
      { itemName: string; qty: number; unit: string }
    >();

    for (let i = 0; i < dto.lines.length; i++) {
      const l = dto.lines[i];
      const id = l?.itemid;
      const qty = l?.receiveqty;

      if (!isValidObjectId(id)) {
        this.logger.warn(`Invalid itemid at lines[${i}]: ${id}`);
        return { msg: 'Receive Item Failed.......', status: false };
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        this.logger.warn(`Invalid receiveqty at lines[${i}]: ${qty}`);
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // Normalize to strings
      const incomingName: string = (l?.itemname ?? '').toString();
      const incomingUnit: string = (l?.unit ?? '').toString();

      const prev = merged.get(id);
      merged.set(id, {
        itemName:
          prev?.itemName && prev.itemName.length > 0
            ? prev.itemName
            : incomingName,
        qty: (prev?.qty ?? 0) + qty,
        unit: prev?.unit && prev.unit.length > 0 ? prev.unit : incomingUnit,
      });
    }

    if (merged.size === 0) {
      return { msg: 'Receive Item Failed.......', status: false };
    }

    // Ensure all items exist
    const ids = Array.from(merged.keys()).map((id) => new Types.ObjectId(id));
    try {
      const existing = await this.itemModel
        .find({ _id: { $in: ids } }, { _id: 1 })
        .lean();
      if (existing.length !== ids.length) {
        const found = new Set(existing.map((d) => String(d._id)));
        const missing = Array.from(merged.keys()).filter(
          (id) => !found.has(id),
        );
        this.logger.warn(`Missing item ids: ${missing.join(', ')}`);
        return { msg: 'Receive Item Failed.......', status: false };
      }
    } catch (e) {
      this.logger.error('Item existence check failed', e as any);
      return { msg: 'Receive Item Failed.......', status: false };
    }

    // Build lines for schema (requestedQty = receiveqty from FE)
    const lines = Array.from(merged.entries()).map(([itemId, v]) => ({
      itemId: new Types.ObjectId(itemId),
      itemName: v.itemName || '',
      requestedQty: v.qty,
      approvedQty: 0,
      receivedQty: 0,
      scrapQty: 0,
      unit: v.unit ?? '',
    }));

    // Generate recNo and save
    try {
      const recNo = await this.nextRecNo();

      const doc = new this.recModel({
        recNo,
        source: dto.source ?? '',
        remark: dto.remark ?? '',
        lines,
        status: 'DRAFT',
        createdBy: new Types.ObjectId(dto.userId),
      });

      await doc.save(); // will throw if schema validation fails
      this.logger.debug(`Created Receiving ${doc._id} recNo=${doc.recNo}`);

      const mvts = Array.from(merged.entries()).map(([itemId, v]) => ({
        itemId: new Types.ObjectId(itemId),
        placeId: '',
        receivingId: doc._id,
        type: 'CREATE',
        qty: v.qty,
        refNo: String(doc.recNo || ''),
        operatedBy: new Types.ObjectId(dto.userId),
        note: 'Receive Create',
      }));

      if (mvts.length) {
        await this.movModel.insertMany(mvts);
      }

      // EXACT response shape you want:
      return { msg: 'Receive Item Created.......', status: true };
    } catch (e) {
      this.logger.error('Create Receiving failed', e as any);
      return { msg: 'Receive Item Failed.......', status: false };
    }
  }

  async listPendingApprovals() {
    return this.recModel.find({ status: 'DRAFT' }).sort({ createdAt: -1 });
  }

  async findAll() {
    return await this.recModel.find().sort({ createdAt: -1 });
  }

  async findOne(id: string) {
    return await this.recModel.findById(id);
  }

  async findPaged(payload: any) {
    const page = Math.max(1, Number(payload?.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(payload?.limit ?? 12)));
    const skip = (page - 1) * limit;

    const s = String(payload?.search ?? '').trim();
    const item = String(payload?.item ?? '').trim();
    const status = payload?.status ? String(payload.status) : undefined;

    const q: any = {};
    if (s) {
      q.$or = [
        { recNo: { $regex: s, $options: 'i' } },
        { source: { $regex: s, $options: 'i' } },
      ];
    }
    if (status) q.status = status;

    // If you want item-name search, pre-join or store denormalized item names on receiving lines.
    if (item) {
      q['lines.itemName'] = { $regex: item, $options: 'i' }; // adjust to your schema
    }

    const sort = ((): Record<string, 1 | -1> => {
      const raw = String(payload?.sort ?? '-createdAt');
      const dir = raw.startsWith('-') ? -1 : 1;
      const f = raw.replace(/^-/, '') || 'createdAt';
      return { [f]: dir };
    })();

    const [rows, total] = await Promise.all([
      this.recModel.find(q).sort(sort).skip(skip).limit(limit).lean(),
      this.recModel.countDocuments(q),
    ]);

    return { rows, total, page, limit };
  }

  async findStatusPaged(body: any) {
    const page = Math.max(1, Number(body?.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(body?.limit ?? 12)));
    const skip = (page - 1) * limit;

    const search = String(body?.search ?? '').trim(); // recNo/source
    const item = String(body?.item ?? '').trim(); // line.itemName/code
    const status = Array.isArray(body?.status) ? body.status.map(String) : [];

    const q: any = {};
    if (status.length) q.status = { $in: status };
    if (search) {
      q.$or = [
        { recNo: { $regex: search, $options: 'i' } },
        { source: { $regex: search, $options: 'i' } },
      ];
    }
    if (item) {
      // If lines have itemName or code saved:
      q['lines.itemName'] = { $regex: item, $options: 'i' };
      // or include code: q.$or = [...(q.$or ?? []), {'lines.itemCode': {$regex:item,$options:'i'}}]
    }

    const sort = (() => {
      const raw = String(body?.sort ?? '-createdAt');
      const dir = raw.startsWith('-') ? -1 : 1;
      const f = raw.replace(/^-/, '') || 'createdAt';
      return { [f]: dir } as Record<string, 1 | -1>;
    })();

    const [rows, total] = await Promise.all([
      this.recModel.find(q).sort(sort).skip(skip).limit(limit).lean(),
      this.recModel.countDocuments(q),
    ]);

    return { rows, total, page, limit };
  }

  async findStatus(status: string[]) {
    return await this.recModel
      .find({ status: { $in: status } })
      .sort({ createdAt: -1 });
  }
  // async approve(dto: any, userId: string) {
  //   const rec = await this.recModel.findById(dto.id);
  //   if (!rec) throw new NotFoundException('Receiving not found');
  //   if (rec.status !== 'DRAFT')
  //     throw new BadRequestException('Only DRAFT can be approved');

  //   // map for quick lookup

  //   const map = new Map(dto.lines.map((l) => [l.itemId, l.approvedQty]));
  //   // validate not exceeding requested
  //   rec.lines.forEach((line) => {
  //     const ap = map.get(String(line.itemId)) ?? 0;
  //     if (ap < 0) throw new BadRequestException('Approved cannot be negative');
  //     if (ap > line.requestedQty) {
  //       throw new BadRequestException('Approved cannot exceed requested');
  //     }
  //     line.approvedQty = ap;
  //   });

  //   rec.status = 'APPROVED';
  //   rec.approvedBy = new Types.ObjectId(userId);
  //   rec.approvedAt = new Date();
  //   await rec.save();
  //   return rec;
  // }

  async historyByItem(itemId: string) {
    return this.movModel
      .find({ itemId: new Types.ObjectId(itemId) })
      .sort({ createdAt: -1 })
      .populate('placeId', 'name code')
      .lean();
  }

  async updateDraft(dto: any) {
    // this.logger.debug(`UpdateDraft payload: ${JSON.stringify(dto)}`);

    // basic checks (DO NOT THROW)
    if (!dto || !dto.id) {
      return { msg: 'Receive Item Failed.......', status: false };
    }
    if (!dto.userId) {
      return { msg: 'Receive Item Failed.......', status: false };
    }
    if (!Array.isArray(dto.lines) || dto.lines.length === 0) {
      return { msg: 'Receive Item Failed.......', status: false };
    }

    // load receiving
    const rec = await this.recModel.findById(dto.id);
    if (!rec) {
      return { msg: 'Receive Item Failed.......', status: false };
    }
    if (rec.status !== 'DRAFT') {
      return { msg: 'Receive Item Failed.......', status: false };
    }

    // normalize & merge lines; validate ids & qty
    const merged = new Map<string, { qty: number; unit: string }>();
    for (let i = 0; i < dto.lines.length; i++) {
      const l = dto.lines[i];
      const id = l?.itemid;
      const qty = l?.receiveqty;

      // if (!isValidObjectId(id)) {
      //   this.logger.warn(`Invalid itemid at lines[${i}]: ${id}`);
      //   return { msg: 'Receive Item Failed.......', status: false };
      // }
      if (!Number.isInteger(qty) || qty <= 0) {
        this.logger.warn(`Invalid receiveqty at lines[${i}]: ${qty}`);
        return { msg: 'Receive Item Failed.......', status: false };
      }
      const prev = merged.get(id);
      merged.set(id, {
        qty: (prev?.qty ?? 0) + qty,
        unit: prev?.unit && prev.unit.length > 0 ? prev.unit : (l?.unit ?? ''),
      });
    }
    if (merged.size === 0) {
      return { msg: 'Receive Item Failed.......', status: false };
    }

    // ensure items exist
    const ids = Array.from(merged.keys()).map((id) => new Types.ObjectId(id));
    try {
      const found = await this.itemModel
        .find({ _id: { $in: ids } }, { _id: 1 })
        .lean();
      if (found.length !== ids.length) {
        const okset = new Set(found.map((d) => String(d._id)));
        const missing = Array.from(merged.keys()).filter(
          (id) => !okset.has(id),
        );
        this.logger.warn(`Missing items in updateDraft: ${missing.join(', ')}`);
        return { msg: 'Receive Item Failed.......', status: false };
      }
    } catch (e) {
      this.logger.error('Item existence check failed (updateDraft)', e as any);
      return { msg: 'Receive Item Failed.......', status: false };
    }

    // build new lines array
    const newLines = Array.from(merged.entries()).map(([itemId, v]) => ({
      itemId: new Types.ObjectId(itemId),
      requestedQty: v.qty,
      approvedQty: 0,
      receivedQty: 0,
      scrapQty: 0,
      unit: v.unit ?? '',
    }));

    try {
      rec.source = dto.source ?? rec.source ?? '';
      rec.remark = dto.remark ?? rec.remark ?? '';
      rec.lines = newLines;
      // keep status DRAFT
      await rec.save();

      const mvts = Array.from(merged.entries()).map(([itemId, v]) => ({
        itemId: new Types.ObjectId(itemId),
        placeId: '',
        receivingId: rec._id,
        type: 'EDIT',
        qty: v.qty,
        refNo: String(rec.recNo || ''),
        operatedBy: new Types.ObjectId(dto.userId),
        note: 'Receive Edit',
      }));

      if (mvts.length) {
        await this.movModel.insertMany(mvts);
      }

      return { msg: 'Receive Item Updated.......', status: true }; // if you want "Updated......." change just the text
    } catch (e) {
      // this.logger.error('Update draft failed', e as any);
      return { msg: 'Receive Item Failed.......', status: false };
    }
  }

  async approveReceive(dto: any) {
    try {
      // --- basic checks ---
      if (!dto?.id || !isValidObjectId(dto.id)) {
        return { msg: 'Receive Item Failed.......', status: false };
      }
      if (!Array.isArray(dto.lines) || dto.lines.length === 0) {
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // --- load receiving (must be DRAFT) ---
      const rec = await this.recModel.findById(dto.id).lean();
      if (!rec || rec.status !== 'DRAFT') {
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // --- merge duplicates & validate each line ---
      // normalize -> Map<hexItemId, totalApprovedQty>
      const merged = new Map<string, number>();
      const idsForExistence: Types.ObjectId[] = [];

      for (const raw of dto.lines) {
        const itemIdStr = String(raw.itemId ?? raw.itemid ?? '').trim();
        const approvedQty = Number(raw.approvedQty ?? raw.approvedqty ?? 0);

        if (!isValidObjectId(itemIdStr)) {
          return { msg: 'Receive Item Failed.......', status: false };
        }
        if (!Number.isInteger(approvedQty) || approvedQty < 0) {
          return { msg: 'Receive Item Failed.......', status: false };
        }

        const hex = new Types.ObjectId(itemIdStr).toHexString();
        merged.set(hex, (merged.get(hex) ?? 0) + approvedQty);
      }

      // --- DB existence check for every itemId in payload ---
      for (const hex of merged.keys()) {
        idsForExistence.push(new Types.ObjectId(hex));
      }
      const existingCount = await this.itemModel.countDocuments({
        _id: { $in: idsForExistence },
      });
      if (existingCount !== idsForExistence.length) {
        // at least one itemId does not exist in StoreItem collection
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // --- build quick lookup of requested per item on this receiving ---
      // key by hex string for consistent comparison
      const lineById = new Map<
        string,
        { requestedQty: number; idx: number; currentApproved: number }
      >();
      (rec.lines ?? []).forEach((l: any, i: number) => {
        const hex = new Types.ObjectId(l.itemId).toHexString();
        lineById.set(hex, {
          requestedQty: Number(l.requestedQty ?? 0),
          idx: i,
          currentApproved: Number(l.approvedQty ?? 0),
        });
      });

      // --- ensure every approved item is part of this receiving and within requested ---
      for (const [hex, appr] of merged.entries()) {
        const line = lineById.get(hex);
        if (!line) {
          // approving an item not on the receiving
          return { msg: 'Receive Item Failed.......', status: false };
        }
        if (appr > line.requestedQty) {
          // cannot approve more than requested
          return { msg: 'Receive Item Failed.......', status: false };
        }
      }

      // --- prepare $set for per-line approvedQty updates ---
      const setPaths: Record<string, any> = {};
      for (const [hex, line] of lineById.entries()) {
        const approved = merged.has(hex)
          ? merged.get(hex)!
          : line.currentApproved;
        setPaths[`lines.${line.idx}.approvedQty`] = approved;
      }

      // --- status & approver ---
      const totalApproved = Array.from(merged.values()).reduce(
        (a, b) => a + b,
        0,
      );
      const newStatus = totalApproved > 0 ? 'APPROVED' : 'DRAFT';

      const update: any = { $set: { ...setPaths, status: newStatus } };

      if (newStatus === 'APPROVED') {
        update.$set.approvedAt = new Date();
        if (dto.userId && isValidObjectId(dto.userId)) {
          update.$set.approvedBy = new Types.ObjectId(dto.userId);
        }
      }

      await this.recModel.updateOne({ _id: rec._id }, update);
      for (const raw of dto.lines) {
        await this.movModel.create({
          itemId: raw.itemid,
          placeId: '',
          receivingId: rec._id,
          type: 'APPROVED',
          qty: raw.approvedqty ?? 0,
          refNo: String(rec.recNo || ''),
          operatedBy: new Types.ObjectId(dto.userId),
          note: 'Receive Approved',
        });
      }

      return { msg: 'Receive Item Approved.......', status: true };
    } catch (err) {
      this.logger.error(`Approve failed: ${err?.message || err}`);
      return { msg: 'Receive Item Failed.......', status: false };
    }
  }

  async rejectReceive(dto: any) {
    try {
      // --- basic checks ---
      if (!dto?.id || !isValidObjectId(dto.id)) {
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // --- load receiving ---
      const rec = await this.recModel.findById(dto.id).lean();
      if (!rec) {
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // Only allow rejecting DRAFT / APPROVED (not CLOSED/CANCELLED)
      if (rec.status !== 'DRAFT' && rec.status !== 'APPROVED') {
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // If anything is already received to a place, we cannot reject
      const hasAnyReceived = (rec.lines ?? []).some(
        (l: any) => Number(l.receivedQty ?? 0) > 0,
      );
      if (hasAnyReceived) {
        // Stock already moved into places; rejecting now would desync quantities.
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // Prepare $set to zero-out any approvedQty (optional but keeps it clean)
      const setPaths: Record<string, any> = {};
      for (let i = 0; i < (rec.lines?.length ?? 0); i++) {
        const l = rec.lines[i];
        const curApproved = Number(l?.approvedQty ?? 0);
        if (curApproved !== 0) {
          setPaths[`lines.${i}.approvedQty`] = 0;
        }
      }

      // Mark as CANCELLED (or use 'REJECTED' if your status set includes it)
      const setDoc: any = {
        status: 'CANCELLED',
        cancelledAt: new Date(), // add these fields in schema if you want to persist them
      };
      if (dto.userId && isValidObjectId(dto.userId)) {
        setDoc.cancelledBy = new Types.ObjectId(dto.userId);
      }

      await this.recModel.updateOne(
        { _id: rec._id },
        { $set: { ...setPaths, ...setDoc } },
      );
      for (const raw of rec.lines) {
        await this.movModel.create({
          itemId: raw.itemId,
          placeId: '',
          receivingId: rec._id,
          type: 'CANCELLED',
          qty: raw.requestedQty,
          refNo: String(rec.recNo || ''),
          operatedBy: new Types.ObjectId(dto.userId),
          note: 'Receive Cancelled',
        });
      }

      return { msg: 'Receive Item Rejected.......', status: true };
    } catch (err) {
      this.logger.error(`rejectReceive failed: ${err?.message || err}`);
      return { msg: 'Receive Item Failed.......', status: false };
    }
  }

  // inside your ReceivingService class

  async receiveToPlaceOne(dto: any) {
    try {
      // -------- 1) Presence + ObjectId format checks --------
      const itemIdRaw = String(dto?.itemid ?? '').trim();
      const placeIdRaw = String(dto?.placeId ?? '').trim();
      const recIdRaw = String(dto?.receiveId ?? '').trim();
      const userIdRaw = dto?.userId ? String(dto.userId).trim() : '';

      if (!itemIdRaw || !placeIdRaw || !recIdRaw) {
        return { msg: 'Receive Item Failed.......', status: false };
      }
      if (
        !isValidObjectId(itemIdRaw) ||
        !isValidObjectId(placeIdRaw) ||
        !isValidObjectId(recIdRaw)
      ) {
        return { msg: 'Receive Item Failed.......', status: false };
      }

      const receiveQty = Number(dto?.quantity ?? 0);
      const scrapQty = Number(dto?.scrapQuantity ?? 0);

      if (!Number.isInteger(receiveQty) || receiveQty < 0)
        return { msg: 'Receive Item Failed.......', status: false };
      if (!Number.isInteger(scrapQty) || scrapQty < 0)
        return { msg: 'Receive Item Failed.......', status: false };
      if (receiveQty + scrapQty <= 0)
        return { msg: 'Receive Item Failed.......', status: false };

      const itemId = new Types.ObjectId(itemIdRaw);
      const placeId = new Types.ObjectId(placeIdRaw);
      const recId = new Types.ObjectId(recIdRaw);
      const operatedBy =
        userIdRaw && isValidObjectId(userIdRaw)
          ? new Types.ObjectId(userIdRaw)
          : undefined;

      // -------- 2) Existence checks for ALL 3 IDs --------
      const [rec, itemDoc, placeDoc] = await Promise.all([
        this.recModel
          .findById(recId, {
            lines: 1,
            status: 1,
            recNo: 1,
            createdBy: 1,
          })
          .lean(),
        this.itemModel.findById(itemId, { _id: 1, name: 1 }).lean(),
        this.placeModel.findById(placeId, { _id: 1, name: 1 }).lean(),
      ]);

      if (!rec || !itemDoc || !placeDoc) {
        return { msg: 'Receive Item Failed.......', status: false };
      }
      if (rec.status !== 'APPROVED') {
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // -------- 3) Receiving line must contain this item; qty within remaining --------
      const lineByHex = new Map<
        string,
        { idx: number; approved: number; received: number; scrap: number }
      >();
      (rec.lines ?? []).forEach((l: any, i: number) => {
        const hex = new Types.ObjectId(l.itemId).toHexString();
        lineByHex.set(hex, {
          idx: i,
          approved: Number(l.approvedQty ?? 0),
          received: Number(l.receivedQty ?? 0),
          scrap: Number(l.scrapQty ?? 0),
        });
      });

      const itemHex = itemId.toHexString();
      const line = lineByHex.get(itemHex);
      if (!line) {
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // remaining must account for both received and scrap
      const totalIn = receiveQty + scrapQty;
      const remaining = line.approved - (line.received + line.scrap);
      if (remaining <= 0 || totalIn > remaining) {
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // ---------- 4) Apply updates ----------
      // (a) update line counters
      const newReceived = line.received + receiveQty;
      const newScrap = line.scrap + scrapQty;
      await this.recModel.updateOne(
        { _id: rec._id },
        {
          $set: {
            [`lines.${line.idx}.receivedQty`]: newReceived,
            [`lines.${line.idx}.scrapQty`]: newScrap,
          },
        },
      );

      // (b) if receive > 0, upsert SPIQ and increment totals
      if (receiveQty > 0) {
        const itemName = itemDoc?.name ?? '';
        const placeName = placeDoc?.name ?? '';

        let spiq = await this.spiqModel.findOne({
          itemId: itemHex,
          placeId: placeId.toHexString(),
        });

        if (!spiq) {
          spiq = await this.spiqModel.create({
            itemId: itemHex,
            itemName,
            placeId: placeId.toHexString(),
            placeName,
            totalQuantity: String(receiveQty), // starts with received qty
            IssuedQuantity: '0',
            completedQuantity: '0',
            remark: '',
            createdBy: userIdRaw || String(rec.createdBy || ''),
          });

          // link SPIQ to place
          await this.placeModel.updateOne(
            { _id: placeId },
            { $addToSet: { StorePlaceItemQuantityIds: spiq._id } },
          );
        } else {
          // increment totalQuantity (string math)
          const current = parseInt(spiq.totalQuantity || '0', 10) || 0;
          spiq.totalQuantity = String(current + receiveQty);
          await spiq.save();
        }

        // (c) item stock: add only the received quantity
        const resAvail = await this.itemModel.updateOne(
          { _id: itemId },
          {
            $inc: {
              stockAvailableQuantity: receiveQty,
              totalStockQuantity: receiveQty,
            },
          },
        );
        if (resAvail.matchedCount !== 1) {
          // very unlikely here, but keep the guard
          throw new Error('Item stock update failed');
        }

        // (d) movement for receive
        await this.movModel.create({
          itemId,
          placeId,
          receivingId: recId,
          type: 'RECEIVE',
          qty: receiveQty,
          refNo: String(rec.recNo || ''),
          operatedBy: operatedBy ?? new Types.ObjectId(rec.createdBy),
          note: 'Receive to place',
        });
      }

      // (e) if scrap > 0, add to item scrap counter and movement
      if (scrapQty > 0) {
        const resScrap = await this.itemModel.updateOne(
          { _id: itemId },
          {
            $inc: {
              stockscrapQuantity: scrapQty,
              totalStockQuantity: scrapQty,
            },
          },
        );
        if (resScrap.matchedCount !== 1) {
          throw new Error('Item scrap update failed');
        }

        await this.movModel.create({
          itemId,
          placeId,
          receivingId: recId,
          type: 'SCRAP',
          qty: scrapQty,
          refNo: String(rec.recNo || ''),
          operatedBy: operatedBy ?? new Types.ObjectId(rec.createdBy),
          note: 'Scrapped during receiving',
        });
      }

      // (f) auto-close when each line is fully handled (received + scrap >= approved)
      const fresh = await this.recModel.findById(rec._id, { lines: 1 }).lean();
      const fullyDone = (fresh?.lines ?? []).every(
        (l: any) =>
          Number(l.receivedQty ?? 0) + Number(l.scrapQty ?? 0) >=
          Number(l.approvedQty ?? 0),
      );
      if (fullyDone) {
        const closeSet: any = { status: 'CLOSED', closedAt: new Date() };
        if (operatedBy) closeSet.closedBy = operatedBy;
        await this.recModel.updateOne({ _id: rec._id }, { $set: closeSet });
      }

      return { msg: 'Receive To Place Completed.......', status: true };
    } catch (err) {
      this.logger.error(`receiveToPlaceOne failed: ${err?.message || err}`);
      return { msg: 'Receive Item Failed.......', status: false };
    }
  }

  async closeReceive(dto: any) {
    try {
      // ---- basic payload checks ----
      if (!dto?.id || !isValidObjectId(dto.id)) {
        return { msg: 'Receive Item Failed.......', status: false };
      }
      const userIdRaw = dto?.userId ? String(dto.userId).trim() : '';
      const operatedBy =
        userIdRaw && isValidObjectId(userIdRaw)
          ? new Types.ObjectId(userIdRaw)
          : undefined;

      // ---- load receiving with lines ----
      const rec = await this.recModel
        .findById(dto.id, { status: 1, recNo: 1, lines: 1, createdBy: 1 })
        .lean();

      if (!rec) {
        return { msg: 'Receive Item Failed.......', status: false };
      }
      if (rec.status === 'CLOSED' || rec.status === 'CANCELLED') {
        // already terminal
        return { msg: 'Receive Item Failed.......', status: false };
      }
      if (rec.status !== 'APPROVED') {
        // keep consistent with your receive flow
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // ---- validate lines: fully received and never over-received ----
      const lines = Array.isArray(rec.lines) ? rec.lines : [];
      for (const l of lines) {
        const approved = Number(l?.approvedQty ?? 0);
        const received = Number(l?.receivedQty ?? 0);

        console.log(l?.approvedQty);
        console.log(l?.receivedQty);
        if (received > approved) {
          return { msg: 'Receive Item Failed.......', status: false };
        }
        // if (received < approved) {
        //   return { msg: 'Receive Item Failed.......', status: false };
        // }
      }

      // ---- mark CLOSED (guard current status) ----
      const setDoc: any = {
        status: 'CLOSED',
        closedAt: new Date(),
      };
      if (operatedBy) setDoc.closedBy = operatedBy;

      const upd = await this.recModel.updateOne(
        { _id: rec._id, status: 'APPROVED' },
        { $set: setDoc },
      );
      if (upd.matchedCount !== 1 || upd.modifiedCount !== 1) {
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // ---- movement audit (no stock delta): one per line, qty = 0, type = ADJUST ----
      try {
        const mvts = (lines || []).map((l: any) => ({
          itemId: new Types.ObjectId(l.itemId),
          // If placeId is required in your schema and you don't have one here,
          // you can set '' (as used elsewhere in your codebase) or make the field optional.
          placeId: '', // keep consistent with your earlier usage
          receivingId: new Types.ObjectId(rec._id),
          type: 'CLOSED' as const,
          qty: 0,
          refNo: String(rec.recNo ?? ''),
          operatedBy: operatedBy ?? new Types.ObjectId(rec.createdBy),
          note: 'Receiving closed',
        }));
        if (mvts.length) {
          await this.movModel.insertMany(mvts);
        }
      } catch (e) {
        // movement is audit-only; if it fails, we still keep the document closed
        this.logger.warn(
          `closeReceive movement log failed: ${e?.message || e}`,
        );
      }

      return { msg: 'Receive Closed.......', status: true };
    } catch (err) {
      this.logger.error(`closeReceive failed: ${err?.message || err}`);
      return { msg: 'Receive Item Failed.......', status: false };
    }
  }

  // service
  async getStats(period: 'day' | 'week' | 'month') {
    const now = new Date();
    const start = new Date(now);
    if (period === 'day') start.setHours(0, 0, 0, 0);
    if (period === 'week') {
      const d = now.getDay();
      start.setDate(now.getDate() - ((d + 6) % 7));
      start.setHours(0, 0, 0, 0);
    }
    if (period === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    const [recvAgg, issueAgg, creatorsRecv, creatorsIssue] = await Promise.all([
      this.recModel.aggregate([
        { $match: { createdAt: { $gte: start, $lte: now } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            v: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.movModel.aggregate([
        { $match: { createdAt: { $gte: start, $lte: now } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            v: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.recModel.aggregate([
        { $match: { createdAt: { $gte: start, $lte: now } } },
        { $group: { _id: '$createdBy', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'u',
            pipeline: [{ $project: { name: 1, email: 1 } }],
          },
        },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        { $project: { name: { $ifNull: ['$u.name', '$u.email'] }, count: 1 } },
      ]),
      this.movModel.aggregate([
        { $match: { createdAt: { $gte: start, $lte: now } } },
        { $group: { _id: '$createdBy', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'u',
            pipeline: [{ $project: { name: 1, email: 1 } }],
          },
        },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        { $project: { name: { $ifNull: ['$u.name', '$u.email'] }, count: 1 } },
      ]),
    ]);

    const recvTotal = recvAgg.reduce((a, b) => a + (b.v || 0), 0);
    const issueTotal = issueAgg.reduce((a, b) => a + (b.v || 0), 0);

    // Merge top creators from both collections
    const topMap = new Map<string, number>();
    for (const x of creatorsRecv)
      topMap.set(x.name, (topMap.get(x.name) ?? 0) + (x.count ?? 0));
    for (const x of creatorsIssue)
      topMap.set(x.name, (topMap.get(x.name) ?? 0) + (x.count ?? 0));
    const topCreators = [...topMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const toSeries = (arr: any[]) =>
      arr.map((e) => ({ t: e._id, v: e.v || 0 }));

    return {
      receivingsTotal: recvTotal,
      issuesTotal: issueTotal,
      netMovement: recvTotal - issueTotal,
      uniqueCreators: topMap.size,
      topCreators,
      recvSeries: toSeries(recvAgg),
      issueSeries: toSeries(issueAgg),
    };
  }

  async getRecent(limit = 20) {
    // union recent receivings + issues with labels; or do two queries and merge/sort in JS
    const [r, i] = await Promise.all([
      this.recModel
        .find({}, { recNo: 1, createdAt: 1, status: 1, createdBy: 1 })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      this.movModel
        .find({}, { issNo: 1, createdAt: 1, status: 1, createdBy: 1 })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    const rows = [
      ...r.map((x: any) => ({
        type: 'RECEIVING',
        no: x.recNo,
        createdAt: x.createdAt,
        status: x.status,
        createdBy: x.createdBy,
        _id: x._id,
      })),
      ...i.map((x: any) => ({
        type: 'ISSUE',
        no: x.issNo,
        createdAt: x.createdAt,
        status: x.status,
        createdBy: x.createdBy,
        _id: x._id,
      })),
    ];

    // attach creator name
    // (optional: batch lookup by unique createdBy ids)
    // keep example simple or add $lookup in aggregation

    rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return rows.slice(0, limit);
  }
}
