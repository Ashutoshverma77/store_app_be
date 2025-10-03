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
      unit: v.unit ?? '',
    }));

    try {
      rec.source = dto.source ?? rec.source ?? '';
      rec.remark = dto.remark ?? rec.remark ?? '';
      rec.lines = newLines;
      // keep status DRAFT
      await rec.save();

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

      return { msg: 'Receive Item Approved.......', status: true };
    } catch (err) {
      this.logger.error(`Approve failed: ${err?.message || err}`);
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

      const qty = Number(dto?.quantity ?? 0);
      if (!Number.isInteger(qty) || qty <= 0) {
        return { msg: 'Receive Item Failed.......', status: false };
      }

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
          .findById(recId, { lines: 1, status: 1, recNo: 1, createdBy: 1 })
          .lean(),
        this.itemModel.findById(itemId, { _id: 1, name: 1 }).lean(),
        this.placeModel.findById(placeId, { _id: 1, name: 1 }).lean(),
      ]);

      if (!rec || !itemDoc || !placeDoc) {
        // at least one of the 3 entities does not exist
        return { msg: 'Receive Item Failed.......', status: false };
      }
      if (rec.status !== 'APPROVED') {
        // tighten approval requirement (change if you want to allow DRAFT too)
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // -------- 3) Receiving line must contain this item; qty within remaining --------
      const lineByHex = new Map<
        string,
        { idx: number; approved: number; received: number }
      >();
      (rec.lines ?? []).forEach((l: any, i: number) => {
        const hex = new Types.ObjectId(l.itemId).toHexString();
        lineByHex.set(hex, {
          idx: i,
          approved: Number(l.approvedQty ?? 0),
          received: Number(l.receivedQty ?? 0),
        });
      });

      const itemHex = itemId.toHexString();
      const line = lineByHex.get(itemHex);
      if (!line) {
        // item not in this receiving
        return { msg: 'Receive Item Failed.......', status: false };
      }

      const remaining = line.approved - line.received;
      if (remaining <= 0 || qty > remaining) {
        // cannot receive 0/negative or more than remaining approved
        return { msg: 'Receive Item Failed.......', status: false };
      }

      // -------- 4) Perform updates (can be wrapped in a session/transaction if desired) --------

      // 4a) Update receiving line's receivedQty
      const newReceived = line.received + qty;
      await this.recModel.updateOne(
        { _id: rec._id },
        { $set: { [`lines.${line.idx}.receivedQty`]: newReceived } },
      );

      // 4b) Upsert StorePlaceItemQuantity (your quantities are strings)
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
          totalQuantity: String(qty), // start with qty
          IssuedQuantity: '0',
          completedQuantity: '0',
          remark: '',
          createdBy: userIdRaw || String(rec.createdBy || ''),
        });

        // ensure the SPIQ id is linked in StorePlace
        await this.placeModel.updateOne(
          { _id: placeId },
          { $addToSet: { StorePlaceItemQuantityIds: spiq._id } },
        );
      } else {
        // increment its totalQuantity (string math)
        const current = parseInt(spiq.totalQuantity || '0', 10) || 0;
        spiq.totalQuantity = String(current + qty);
        await spiq.save();
      }

      // 4c) Write stock movement
      await this.movModel.create({
        itemId,
        placeId,
        receivingId: recId,
        type: 'RECEIVE',
        qty, // positive
        refNo: String(rec.recNo || ''),
        operatedBy: operatedBy ?? new Types.ObjectId(rec.createdBy),
        note: 'Receive to place',
      });

      // 4d) Increase item stock counters (do NOT exceed approved — we checked already)
      await this.itemModel.updateOne(
        { _id: itemId },
        {
          $inc: {
            stockAvailableQuantity: qty,
            totalStockQuantity: qty,
          },
        },
      );

      // 4e) Auto-close receiving if all fully received
      const fresh = await this.recModel.findById(rec._id, { lines: 1 }).lean();
      const fullyReceived = (fresh?.lines ?? []).every(
        (l: any) => Number(l.receivedQty ?? 0) >= Number(l.approvedQty ?? 0),
      );
      if (fullyReceived) {
        const closeSet: any = { status: 'CLOSED', closedAt: new Date() };
        if (operatedBy) closeSet.closedBy = operatedBy;
        await this.recModel.updateOne({ _id: rec._id }, { $set: closeSet });
      }

      // -------- 5) Done --------
      return { msg: 'Receive To Place Completed.......', status: true };
    } catch (err) {
      this.logger.error(`receiveToPlaceOne failed: ${err?.message || err}`);
      return { msg: 'Receive Item Failed.......', status: false };
    }
  }
}
