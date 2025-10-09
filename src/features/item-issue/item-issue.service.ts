// src/issue/issue.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, isValidObjectId } from 'mongoose';
import { Issue } from './schema/item-issue.schema';
import { StoreItem } from '../store-item/schema/store-item.schema';
import { StorePlace } from '../store-place/schema/store-place.schema';
import { StorePlaceItemQuantity } from '../store-place/schema/store-place-item-quantity.schema';
import { StockMovement } from '../item-receive/schema/stock-movement.schema';

@Injectable()
export class IssueService {
  private readonly logger = new Logger(IssueService.name);

  constructor(
    @InjectModel(Issue.name, 'store')
    private readonly issModel: Model<Issue>,

    @InjectModel(StoreItem.name, 'store')
    private readonly itemModel: Model<StoreItem>,

    @InjectModel(StorePlace.name, 'store')
    private readonly placeModel: Model<StorePlace>,

    @InjectModel(StorePlaceItemQuantity.name, 'store')
    private readonly spiqModel: Model<StorePlaceItemQuantity>,

    @InjectModel(StockMovement.name, 'store')
    private readonly movModel: Model<StockMovement>,
  ) {}

  // ---- helpers to deal with string-quantities on StorePlaceItemQuantity ----
  private toInt(s: any): number {
    const n = parseInt(String(s ?? '0'), 10);
    return Number.isFinite(n) ? n : 0;
  }
  private toStr(n: number): string {
    return String(n);
  }

  private async nextIssNo(): Promise<string> {
    // simple counter pattern; replace as you do for Receiving
    const y = new Date().getFullYear();
    const seq = Math.floor(Math.random() * 90000) + 10000;
    return `ISS-${y}-${seq.toString().padStart(5, '0')}`;
  }

  /* ============================================================
   * 1) CREATE ISSUE (DRAFT)
   * dto: { userId, reason?, remark?, lines:[{itemid, qty, unit?}] }
   * - All IDs valid & exist
   * - qty > 0
   * - Validate against item.available at creation (as requested)
   *   (does not deduct yet — deduction happens at approval)
   * ============================================================ */
  async createIssue(dto: any) {
    try {
      // ---- Basic shape ----
      if (!dto || !Array.isArray(dto.lines) || dto.lines.length === 0) {
        return { msg: 'Issue Item Failed.......', status: false };
      }
      if (!dto.userId || !isValidObjectId(dto.userId)) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- Normalize, validate, merge duplicates ----
      const merged = new Map<
        string,
        { qty: number; unit: string; name: string }
      >();
      for (let i = 0; i < dto.lines.length; i++) {
        const l = dto.lines[i];
        const id = String(l?.itemid ?? '').trim();
        const qty = Number(l?.qty ?? l?.issueqty ?? l?.receiveqty ?? 0);
        const unit = String(l?.unit ?? '');
        const name = String(l?.itemname ?? '');

        if (!isValidObjectId(id)) {
          return { msg: 'Issue Item Failed.......', status: false };
        }
        if (!Number.isInteger(qty) || qty <= 0) {
          return { msg: 'Issue Item Failed.......', status: false };
        }

        const prev = merged.get(id);
        merged.set(id, {
          qty: (prev?.qty ?? 0) + qty,
          unit: prev?.unit || unit,
          name: prev?.name || name,
        });
      }
      if (merged.size === 0) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- Existence + availability guard (against stockAvailableQuantity) ----
      const ids = Array.from(merged.keys()).map((id) => new Types.ObjectId(id));
      const items = await this.itemModel
        .find({ _id: { $in: ids } }, { _id: 1, stockAvailableQuantity: 1 })
        .lean();

      if (items.length !== ids.length) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      const availByHex: Record<string, number> = {};
      for (const it of items) {
        const hex = new Types.ObjectId(it._id).toHexString();
        availByHex[hex] = Number(it.stockAvailableQuantity ?? 0);
      }
      for (const [id, v] of merged.entries()) {
        const hex = new Types.ObjectId(id).toHexString();
        if ((availByHex[hex] ?? 0) < v.qty) {
          // not enough available to reserve
          return { msg: 'Issue Item Failed.......', status: false };
        }
      }

      // ---- Build Issue doc (DRAFT) ----
      const issNo = await this.nextIssNo?.(); // or whatever your number generator is
      const lines = Array.from(merged.entries()).map(([itemId, v]) => ({
        itemId: new Types.ObjectId(itemId),
        itemName: v.name ?? '',
        requestedQty: v.qty, // requested for issue
        approvedQty: 0, // approval flow (if you use it)
        issuedQty: 0, // actual issued later
        unit: v.unit ?? '',
      }));

      // Create first so we have an iss._id for logging; if stock update fails we delete it
      const issDoc = new this.issModel({
        issNo,
        reason: String(dto.reason ?? ''),
        remark: String(dto.remark ?? ''),
        lines,
        status: 'DRAFT',
        createdBy: new Types.ObjectId(dto.userId),
      });
      await issDoc.save();

      // ---- Reserve stock: stockAvailableQuantity -= qty; stockIssueQuantity += qty (guarded) ----
      for (const [id, v] of merged.entries()) {
        const res = await this.itemModel.updateOne(
          {
            _id: new Types.ObjectId(id),
            stockAvailableQuantity: { $gte: v.qty }, // guard: no minus
          },
          {
            $inc: {
              stockAvailableQuantity: -v.qty,
              stockIssueQuantity: +v.qty,
            },
          },
        );
        if (res.matchedCount !== 1 || res.modifiedCount !== 1) {
          // rollback the issue doc if any reservation fails to keep data clean
          await this.issModel.deleteOne({ _id: issDoc._id });
          return { msg: 'Issue Item Failed.......', status: false };
        }
      }

      // (Optional) Movement log: “RESERVE” (custom) or “ADJUST” with qty 0
      // await this.movModel.insertMany([...]);

      return { msg: 'Issue Item Created.......', status: true };
    } catch (e) {
      this.logger.error(`createIssue failed: ${e?.message || e}`);
      return { msg: 'Issue Item Failed.......', status: false };
    }
  }

  async update(dto: any) {
    try {
      // ---- basic payload checks (keep your uniform return shape) ----
      if (!dto?.id || !isValidObjectId(dto.id)) {
        return { msg: 'Issue Item Failed.......', status: false };
      }
      if (!Array.isArray(dto.lines) || dto.lines.length === 0) {
        return { msg: 'Issue Item Failed.......', status: false };
      }
      if (dto.userId && !isValidObjectId(dto.userId)) {
        // userId is optional, but if present must be valid
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- load existing issue; must be DRAFT ----
      const issue = await this.issModel.findById(dto.id).lean();
      if (!issue) {
        return { msg: 'Issue Item Failed.......', status: false };
      }
      if (issue.status !== 'DRAFT') {
        // do not allow edits once approved/closed/cancelled
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- normalize + validate + merge duplicates by itemid ----
      // Map: itemIdHex -> { name, qty, unit }
      const merged = new Map<
        string,
        { name: string; qty: number; unit: string }
      >();

      for (let i = 0; i < dto.lines.length; i++) {
        const l = dto.lines[i];
        const itemIdRaw = (l?.itemid ?? l?.itemId ?? '').toString().trim();
        const qty = Number(l?.issueqty ?? l?.qty ?? 0);
        const unit = (l?.unit ?? '').toString();
        const nameFromDto = (l?.itemname ?? '').toString();

        if (!isValidObjectId(itemIdRaw)) {
          this.logger.warn(`Invalid itemid at lines[${i}]: ${itemIdRaw}`);
          return { msg: 'Issue Item Failed.......', status: false };
        }
        if (!Number.isInteger(qty) || qty <= 0) {
          this.logger.warn(`Invalid issueqty at lines[${i}]: ${qty}`);
          return { msg: 'Issue Item Failed.......', status: false };
        }

        const key = new Types.ObjectId(itemIdRaw).toHexString();
        const prev = merged.get(key);
        merged.set(key, {
          name: prev?.name && prev.name.length ? prev.name : nameFromDto,
          qty: (prev?.qty ?? 0) + qty,
          unit: prev?.unit && prev.unit.length ? prev.unit : unit,
        });
      }

      if (merged.size === 0) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- ensure all items exist; also fetch names & available stock ----
      const itemIds = Array.from(merged.keys()).map(
        (idHex) => new Types.ObjectId(idHex),
      );
      const items = await this.itemModel
        .find(
          { _id: { $in: itemIds } },
          { _id: 1, name: 1, unit: 1, stockAvailableQuantity: 1 },
        )
        .lean();

      if (items.length !== itemIds.length) {
        const found = new Set(items.map((d) => d._id.toHexString()));
        const missing = Array.from(merged.keys()).filter((k) => !found.has(k));
        this.logger.warn(`Missing item ids: ${missing.join(', ')}`);
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // Build quick map from DB
      const dbById = new Map(
        items.map((it) => [
          it._id.toHexString(),
          {
            name: String(it.name ?? ''),
            unit: String(it.unit ?? ''),
            avail: Number(it.stockAvailableQuantity ?? 0),
          },
        ]),
      );

      // (Optional but recommended) Check requestedQty does not exceed available stock *at edit time*.
      // This prevents planning a negative inventory on approval.
      for (const [idHex, v] of merged.entries()) {
        const db = dbById.get(idHex)!;
        // Use the larger of DTO-provided name vs DB name
        const chosenName = v.name && v.name.trim().length ? v.name : db.name;
        // if unit missing in DTO, use DB unit
        const chosenUnit = v.unit && v.unit.trim().length ? v.unit : db.unit;

        // Save back into map so we have clean values
        merged.set(idHex, { name: chosenName, qty: v.qty, unit: chosenUnit });

        if (v.qty > db.avail) {
          this.logger.warn(
            `Requested issueqty (${v.qty}) > available (${db.avail}) for item ${idHex}`,
          );
          return { msg: 'Issue Item Failed.......', status: false };
        }
      }

      // ---- build new lines for the Issue doc ----
      // We map "issueqty" from FE to "requestedQty" in schema for DRAFT
      const newLines = Array.from(merged.entries()).map(([idHex, v]) => ({
        itemId: new Types.ObjectId(idHex),
        itemName: v.name, // store name for convenience/history (if your schema has it)
        requestedQty: v.qty,
        approvedQty: Number(0), // still DRAFT
        issuedQty: Number(0), // nothing issued yet
        unit: v.unit ?? '',
      }));

      // ---- apply update ----
      await this.issModel.updateOne(
        { _id: issue._id },
        {
          $set: {
            reason: String(dto.reason ?? issue.reason ?? ''),
            lines: newLines,
            // status remains DRAFT
            updatedAt: new Date(),
          },
        },
      );

      return { msg: 'Issue Item Updated.......', status: true };
    } catch (err) {
      this.logger.error(`Issue update failed: ${err?.message || err}`);
      return { msg: 'Issue Item Failed.......', status: false };
    }
  }

  /* ============================================================
   * 2) APPROVE ISSUE
   * dto: { id, userId?, lines:[{itemId, approvedQty}] }
   * - ID valid & exists
   * - doc must be DRAFT (or allow APPROVED->reapprove if you want)
   * - approvedQty ≤ requested
   * - Deduct from StoreItem stock (available & total)
   * - Prevent negative always (server authoritative)
   * - Write StockMovement (type 'ISSUE')
   * ============================================================ */
  async approveIssue(dto: any) {
    try {
      if (!dto?.id || !isValidObjectId(dto.id)) {
        return { msg: 'Issue Item Failed.......', status: false };
      }
      if (!Array.isArray(dto.lines) || dto.lines.length === 0) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      const iss = await this.issModel.findById(dto.id).lean();
      if (!iss) return { msg: 'Issue Item Failed.......', status: false };
      if (iss.status !== 'DRAFT') {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // merge per item and basic checks
      const merged = new Map<string, number>(); // itemId -> approved
      for (const l of dto.lines) {
        const itemId = String(l.itemId ?? l.itemid ?? '').trim();
        const qty = Number(l.approvedQty ?? l.qty ?? 0);
        if (!isValidObjectId(itemId) || !Number.isInteger(qty) || qty < 0) {
          return { msg: 'Issue Item Failed.......', status: false };
        }
        merged.set(itemId, (merged.get(itemId) ?? 0) + qty);
      }

      // map existing requested
      const lineById = new Map<
        string,
        { idx: number; requested: number; approved: number; issued: number }
      >();
      (iss.lines ?? []).forEach((l: any, i: number) => {
        const key = String(l.itemId);
        lineById.set(key, {
          idx: i,
          requested: Number(l.requestedQty ?? 0),
          approved: Number(l.approvedQty ?? 0),
          issued: Number(l.issuedQty ?? 0),
        });
      });

      // validate not exceeding requested and not negative on stock
      const toDeductByItem: Record<string, number> = {};
      for (const [itemId, appr] of merged.entries()) {
        const line = lineById.get(itemId);
        if (!line) return { msg: 'Issue Item Failed.......', status: false };
        if (appr > line.requested) {
          return { msg: 'Issue Item Failed.......', status: false };
        }
        toDeductByItem[itemId] = appr;
      }

      // check item availability NOW (server authority)
      const ids = Object.keys(toDeductByItem).map(
        (id) => new Types.ObjectId(id),
      );
      const items = await this.itemModel
        .find(
          { _id: { $in: ids } },
          { _id: 1, name: 1, stockAvailableQuantity: 1, totalStockQuantity: 1 },
        )
        .lean();
      if (items.length !== ids.length) {
        return { msg: 'Issue Item Failed.......', status: false };
      }
      // for (const it of items) {
      //   const idHex = String(it._id);
      //   const need = toDeductByItem[idHex] ?? 0;
      //   const avail = Number(it.stockAvailableQuantity ?? 0);
      //   const total = Number(it.totalStockQuantity ?? 0);
      //   if (need > avail || need > total) {
      //     return { msg: 'Issue Item Failed.......', status: false };
      //   }
      // }

      // transaction (optional but recommended)
      // const session = await this.conn.startSession();
      // session.startTransaction();
      try {
        // set approved on lines
        const setPaths: Record<string, any> = {};
        for (const [iid, qty] of merged.entries()) {
          const line = lineById.get(iid)!;
          setPaths[`lines.${line.idx}.approvedQty`] = qty;
        }
        await this.issModel.updateOne(
          { _id: iss._id },
          {
            $set: {
              ...setPaths,
              status: 'APPROVED',
              approvedAt: new Date(),
              ...(dto.userId && isValidObjectId(dto.userId)
                ? { approvedBy: new Types.ObjectId(dto.userId) }
                : {}),
            },
          },
          // { session }
        );

        // deduct from StoreItem stock + write movements (type ISSUE)
        for (const it of items) {
          const idHex = String(it._id);
          const qty = toDeductByItem[idHex];

          await this.itemModel.updateOne(
            { _id: it._id },
            {
              $inc: {
                stockAvailableQuantity: -qty,
              },
            },
            // { session }
          );

          await this.movModel.create(
            [
              {
                itemId: new Types.ObjectId(idHex),
                placeId: '', // unknown/global at approval
                receivingId: '', // not a receiving
                issueId: new Types.ObjectId(iss._id),
                type: 'ISSUE',
                qty, // positive; semantics = issue
                refNo: String(iss.issNo),
                operatedBy:
                  dto.userId && isValidObjectId(dto.userId)
                    ? new Types.ObjectId(dto.userId)
                    : new Types.ObjectId(iss.createdBy),
                note: 'Issue approved',
              },
            ],
            // { session }
          );
        }

        // await session.commitTransaction();
      } catch (e) {
        // await session.abortTransaction();
        this.logger.error(`approveIssue tx failed: ${e?.message || e}`);
        return { msg: 'Issue Item Failed.......', status: false };
      } finally {
        // session.endSession();
      }

      return { msg: 'Issue Approved.......', status: true };
    } catch (e) {
      this.logger.error(`approveIssue failed: ${e?.message || e}`);
      return { msg: 'Issue Item Failed.......', status: false };
    }
  }

  async rejectIssue(dto: any) {
    try {
      // ---- basic shape ----
      if (!dto?.id || !isValidObjectId(dto.id)) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- load issue ----
      const iss = await this.issModel.findById(dto.id).lean();
      if (!iss) return { msg: 'Issue Item Failed.......', status: false };

      // only allow reject while not closed/cancelled
      if (iss.status !== 'DRAFT' && iss.status !== 'APPROVED') {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      if ((iss.lines ?? []).some((l) => Number(l.issuedQty ?? 0) > 0)) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- compute how much to release per item
      // we reserved at CREATE the full requestedQty; as issues happen, issuedQty grows,
      // so remaining reserved for this issue = requestedQty - issuedQty
      const releaseByItem: Record<string, number> = {};
      for (const l of iss.lines ?? []) {
        const itemId = String(l.itemId);
        const requested = Number(l.requestedQty ?? 0);
        const issued = Number(l.issuedQty ?? 0);
        const release = Math.max(0, requested - issued);
        if (release > 0) {
          releaseByItem[itemId] = (releaseByItem[itemId] ?? 0) + release;
        }
      }

      // If nothing left reserved, still cancel the issue (nothing to release)
      const itemIds = Object.keys(releaseByItem);

      // ---- existence check for items (defensive)
      if (itemIds.length > 0) {
        const ids = itemIds.map((id) => new Types.ObjectId(id));
        const found = await this.itemModel.countDocuments({
          _id: { $in: ids },
        });
        if (found !== ids.length) {
          return { msg: 'Issue Item Failed.......', status: false };
        }
      }

      // ---------- Transaction recommended (kept inline without session for brevity) ----------
      try {
        // 1) Move remaining reservation back to available (atomic guards)
        for (const [itemId, qty] of Object.entries(releaseByItem)) {
          const res = await this.itemModel.updateOne(
            {
              _id: new Types.ObjectId(itemId),
              // guard so stockIssueQuantity never goes negative
              stockIssueQuantity: { $gte: qty },
            },
            {
              $inc: {
                stockIssueQuantity: -qty,
                stockAvailableQuantity: +qty,
              },
            },
          );
          if (res.matchedCount !== 1 || res.modifiedCount !== 1) {
            // if any guard fails, abort the whole reject
            throw new Error('Reservation release would go negative');
          }
        }

        // 2) Movement logs (optional): record the release as ADJUST
        //    qty = released amount (positive). No placeId/receivingId for a reject.
        if (itemIds.length > 0) {
          const movements = itemIds.map((iid) => ({
            itemId: new Types.ObjectId(iid),
            placeId: '',
            receivingId: '',
            issueId: new Types.ObjectId(iss._id),
            type: 'ADJUST' as const,
            qty: Number(releaseByItem[iid]),
            refNo: String(iss.issNo ?? ''),
            operatedBy:
              dto.userId && isValidObjectId(dto.userId)
                ? new Types.ObjectId(dto.userId)
                : new Types.ObjectId(iss.createdBy),
            note: 'Issue rejected: release reservation back to available',
          }));
          await this.movModel.insertMany(movements);
        }

        // 3) Mark issue as CANCELLED/REJECTED
        const set: any = {
          status: 'CANCELLED', // or 'REJECTED' if you prefer
          cancelledAt: new Date(), // add this field in schema if you want
        };
        if (dto.userId && isValidObjectId(dto.userId)) {
          set.cancelledBy = new Types.ObjectId(dto.userId); // add in schema if desired
        }
        await this.issModel.updateOne({ _id: iss._id }, { $set: set });
      } catch (err) {
        this.logger.error(`rejectIssue tx failed: ${err?.message || err}`);
        return { msg: 'Issue Item Failed.......', status: false };
      }

      return { msg: 'Issue Rejected.......', status: true };
    } catch (e) {
      this.logger.error(`rejectIssue failed: ${e?.message || e}`);
      return { msg: 'Issue Item Failed.......', status: false };
    }
  }

  async findAll() {
    return await this.issModel.find().sort({ createdAt: -1 });
  }

  async findOne(id: string) {
    return await this.issModel.findById(id);
  }

  async findPaged(body: any) {
    const page = Math.max(1, Number(body?.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(body?.limit ?? 12)));
    const skip = (page - 1) * limit;

    const s = String(body?.search ?? '').trim();
    const status = (body?.status ?? null) as string | null;
    const sortStr = String(body?.sort ?? '-createdAt');
    const dir = sortStr.startsWith('-') ? -1 : 1;
    const field = sortStr.replace(/^-/, '') || 'createdAt';
    const sort: Record<string, 1 | -1> = { [field]: dir };

    const q: any = {};
    if (status) q.status = status;

    if (s) {
      q.$or = [
        { issNo: { $regex: s, $options: 'i' } },
        { reason: { $regex: s, $options: 'i' } },
        // If your Issue has items embedded with names:
        // { 'lines.itemName': { $regex: s, $options: 'i' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.issModel.find(q).sort(sort).skip(skip).limit(limit).lean(),
      this.issModel.countDocuments(q),
    ]);
    return { rows, total, page, limit };
  }

  async findStatusPaged(body: any) {
    const page = Math.max(1, Number(body?.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(body?.limit ?? 10)));
    const skip = (page - 1) * limit;

    const s = String(body?.search ?? '').trim();
    const status = (body?.status ?? null) as string | null;

    const sortStr = String(body?.sort ?? '-createdAt');
    const dir = sortStr.startsWith('-') ? -1 : 1;
    const field = sortStr.replace(/^-/, '') || 'createdAt';
    const sort: Record<string, 1 | -1> = { [field]: dir };

    const q: any = {};
    if (status) q.status = status;

    if (s) {
      q.$or = [
        { issNo: { $regex: s, $options: 'i' } },
        { reason: { $regex: s, $options: 'i' } },
        // works if you store itemName in the line:
        { 'lines.itemName': { $regex: s, $options: 'i' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.issModel.find(q).sort(sort).skip(skip).limit(limit).lean(),
      this.issModel.countDocuments(q),
    ]);

    return { rows, total, page, limit };
  }

  async findListByItem(itemIdRaw: string) {
    const itemId = new Types.ObjectId(itemIdRaw);

    // Query APPROVED issues that contain this item in lines
    return await this.issModel
      .find(
        { status: 'APPROVED', 'lines.itemId': itemId },
        { _id: 1, issNo: 1, lines: 1 },
      )
      .lean();
  }

  async findStatus(status: string[]) {
    return await this.issModel
      .find({ status: { $in: status } })
      .sort({ createdAt: -1 });
  }

  /* ============================================================
   * 3) ISSUE FROM PLACE
   * dto: { id, parts:[{ itemId, placeId, qty }], userId? }
   * - Issue doc must be APPROVED (or keep DRAFT if you prefer)
   * - Each place must have enough available
   *   placeAvailable = totalQuantity - IssuedQuantity - completedQuantity
   * - Update line.issuedQty, SPIQ counters, and movements
   * - Never negative anywhere
   * - Close issue if fully issued
   * ============================================================ */
  async issueFromPlace(dto: any) {
    try {
      // ---- normalize single-part payload into "parts" ----
      const issueIdRaw = String(dto?.issueId ?? '').trim();
      const itemIdRaw = String(dto?.itemid ?? dto?.itemId ?? '').trim();
      const placeIdRaw = String(dto?.placeId ?? '').trim();
      const qtyRaw = Number(dto?.quantity ?? dto?.qty ?? 0);

      if (
        !isValidObjectId(issueIdRaw) ||
        !isValidObjectId(itemIdRaw) ||
        !isValidObjectId(placeIdRaw) ||
        !Number.isInteger(qtyRaw) ||
        qtyRaw <= 0
      ) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      const issueId = new Types.ObjectId(issueIdRaw);
      const itemId = new Types.ObjectId(itemIdRaw);
      const placeId = new Types.ObjectId(placeIdRaw);

      // ---- existence checks: ensure all IDs exist ----
      const [issueDoc, itemDoc, placeDoc] = await Promise.all([
        this.issModel.findById(issueId).lean(),
        this.itemModel.findById(itemId).lean(),
        this.placeModel.findById(placeId).lean(),
      ]);

      if (!issueDoc || !itemDoc || !placeDoc) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- issue must be APPROVED ----
      if (issueDoc.status !== 'APPROVED') {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- build line map from issue ----
      const lineByItem = new Map<
        string,
        { idx: number; approved: number; issued: number; returned: number }
      >();
      (issueDoc.lines ?? []).forEach((l: any, i: number) => {
        const hex = new Types.ObjectId(l.itemId).toHexString();
        lineByItem.set(hex, {
          idx: i,
          approved: Number(l.approvedQty ?? 0),
          issued: Number(l.issuedQty ?? 0),
          returned: Number(l.returnQty ?? 0),
        });
      });

      const itemHex = itemId.toHexString();
      const placeHex = placeId.toHexString();
      const qty = qtyRaw;

      // ---- check item is on issue ----
      const line = lineByItem.get(itemHex);
      if (!line) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- remaining check ----
      const remaining = line.approved - line.issued;
      if (qty > remaining) {
        return { msg: 'Issue Item Failed.......', status: false };
      }
      if (0 > remaining) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- per-place availability check (SPIQ) ----
      const spiq = await this.spiqModel
        .findOne({ itemId: itemHex, placeId: placeHex })
        .lean();
      if (!spiq) {
        return { msg: 'Issue Item Failed.......', status: false };
      }
      const total = this.toInt(spiq.totalQuantity);
      const issuedHere = this.toInt(spiq.IssuedQuantity);
      const completed = this.toInt(spiq.completedQuantity);
      const placeAvail = total - issuedHere - completed;
      if (qty > placeAvail) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---- reserved stock guard on StoreItem ----
      if ((itemDoc.stockIssueQuantity ?? 0) < qty) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      // ---------- Transaction (commented here) ----------
      try {
        // 1) Update issue line
        const newIssued = line.issued + qty;
        const newApproved = line.approved - qty;
        await this.issModel.updateOne(
          { _id: issueDoc._id },
          {
            $set: {
              [`lines.${line.idx}.issuedQty`]: newIssued,
              [`lines.${line.idx}.approvedQty`]: newApproved,
            },
          },
        );

        // 2) Update StoreItem counters: move reserved -> completed
        const res = await this.itemModel.updateOne(
          {
            _id: itemId,
            stockIssueQuantity: { $gte: qty }, // atomic guard
          },
          {
            $inc: {
              stockIssueQuantity: -qty,
              stockissueCompleted: +qty,
            },
          },
        );
        if (res.matchedCount !== 1 || res.modifiedCount !== 1) {
          throw new Error('Reserved stock would go negative');
        }

        // 3) Update SPIQ (IssuedQuantity += qty)
        const spiqDoc = await this.spiqModel.findOne({
          itemId: itemHex,
          placeId: placeHex,
        });
        const curIssued = this.toInt(spiqDoc!.IssuedQuantity);
        spiqDoc!.IssuedQuantity = this.toStr(curIssued + qty);
        await spiqDoc!.save();

        // 4) Movement record
        await this.movModel.create({
          itemId,
          placeId,
          issueId,
          type: 'ISSUE',
          qty,
          refNo: String(issueDoc.issNo ?? ''),
          operatedBy:
            dto.userId && isValidObjectId(dto.userId)
              ? new Types.ObjectId(dto.userId)
              : new Types.ObjectId(issueDoc.createdBy),
          note: 'Issue to place (reserved → completed)',
        });

        // 5) Auto-close if fully issued
        const fresh = await this.issModel.findById(issueDoc._id).lean();
        const fullyIssued = (fresh?.lines ?? []).every(
          (l: any) => Number(l.issuedQty ?? 0) >= Number(l.approvedQty ?? 0),
        );
        if (fullyIssued) {
          await this.issModel.updateOne(
            { _id: issueDoc._id },
            {
              $set: {
                status: 'CLOSED',
                closedAt: new Date(),
                ...(dto.userId && isValidObjectId(dto.userId)
                  ? { closedBy: new Types.ObjectId(dto.userId) }
                  : {}),
              },
            },
          );
        }
      } catch (e) {
        this.logger.error(`issueFromPlace tx failed: ${e?.message || e}`);
        return { msg: 'Issue Item Failed.......', status: false };
      }

      return { msg: 'Issue From Place Completed.......', status: true };
    } catch (e) {
      this.logger.error(`issueFromPlace outer failed: ${e?.message || e}`);
      return { msg: 'Issue Item Failed.......', status: false };
    }
  }

  /* ============================================================
   * 4) RETURN TO STOCK
   * dto: { parts:[{ itemId, placeId, qty }], userId? }
   * - qty > 0
   * - increments place totalQuantity and item stocks
   * - movement type 'RETURN'
   * ============================================================ */
  // Payload (single return)
  // {
  //   userId: '68d...',
  //   itemid: '68d...',
  //   placeId: '68d...',
  //   issueId: '68d...',
  //   quantity: 500
  // }

  async returnToStock(dto: any) {
    try {
      // --------- 1) Validate shape & ObjectId format ----------
      const userIdRaw = String(dto?.userId ?? '').trim();
      const itemIdRaw = String(dto?.itemid ?? dto?.itemId ?? '').trim();
      const placeIdRaw = String(dto?.placeId ?? '').trim();
      const issueIdRaw = String(dto?.issueId ?? '').trim();
      const qty = Number(dto?.quantity ?? dto?.qty ?? 0);

      if (
        !isValidObjectId(itemIdRaw) ||
        !isValidObjectId(placeIdRaw) ||
        !isValidObjectId(issueIdRaw) ||
        !Number.isInteger(qty) ||
        qty <= 0
      ) {
        return { msg: 'Return Item Failed.......', status: false };
      }
      if (userIdRaw && !isValidObjectId(userIdRaw)) {
        // userId is optional, but if provided must be valid
        return { msg: 'Return Item Failed.......', status: false };
      }

      const itemId = new Types.ObjectId(itemIdRaw);
      const placeId = new Types.ObjectId(placeIdRaw);
      const issueId = new Types.ObjectId(issueIdRaw);
      const opUser = userIdRaw ? new Types.ObjectId(userIdRaw) : undefined;

      // --------- 2) Existence checks (IDs must exist) ----------
      const [issueDoc, itemDoc, placeDoc] = await Promise.all([
        this.issModel.findById(issueId).lean(),
        this.itemModel.findById(itemId).lean(),
        this.placeModel.findById(placeId).lean(),
      ]);
      if (!issueDoc || !itemDoc || !placeDoc) {
        return { msg: 'Return Item Failed.......', status: false };
      }

      // --------- 3) Item must be on this Issue; check issued qty ----------
      const lineIndex = (issueDoc.lines ?? []).findIndex(
        (l: any) => String(l.itemId) === String(itemId),
      );
      if (lineIndex < 0) {
        // returning an item that was never issued on this Issue
        return { msg: 'Return Item Failed.......', status: false };
      }
      const line = issueDoc.lines[lineIndex];
      const issuedSoFar = Number(line.issuedQty ?? 0);
      const returnSoFar = Number(line.returnQty ?? 0);
      const checkissue = Number(line.issuedQty ?? 0) - qty;
      if (qty > issuedSoFar) {
        // cannot return more than issued
        return { msg: 'Return Item Failed.......', status: false };
      }

      if (0 > checkissue) {
        // cannot return more than issued
        return { msg: 'Return Item Failed.......', status: false };
      }

      // --------- 4) Per-place check (SPIQ) : IssuedQuantity must have enough to subtract ----------
      const itemHex = itemId.toHexString();
      const placeHex = placeId.toHexString();
      const spiq = await this.spiqModel
        .findOne({ itemId: itemHex, placeId: placeHex })
        .lean();
      if (!spiq) {
        // If there is no place stock record, there is nothing to "return" from this place
        return { msg: 'Return Item Failed.......', status: false };
      }
      const spiqIssued = this.toInt(spiq.IssuedQuantity);
      if (qty > spiqIssued) {
        // cannot lower IssuedQuantity below 0
        return { msg: 'Return Item Failed.......', status: false };
      }

      // --------- 5) StoreItem guard: stockissueCompleted must be >= qty ----------
      const sic = Number(itemDoc.stockissueCompleted ?? 0);
      if (sic < qty) {
        // cannot make stockissueCompleted negative
        return { msg: 'Return Item Failed.......', status: false };
      }

      // ---------- 6) Apply updates atomically (recommended to use a session/transaction) ----------
      // const session = await this.conn.startSession();
      // session.startTransaction();
      try {
        // (a) Decrease issue line's issuedQty (cannot go below 0)
        const newIssuedQty = issuedSoFar - qty;
        const newReturnQty = returnSoFar + qty;
        const resIssue = await this.issModel.updateOne(
          { _id: issueId },
          {
            $set: {
              [`lines.${lineIndex}.issuedQty`]: newIssuedQty,
              [`lines.${lineIndex}.returnQty`]: newReturnQty,
            },
          },
          // { session }
        );
        if (resIssue.matchedCount !== 1) {
          throw new Error('Failed to update issue line');
        }

        // (b) StoreItem counters:
        //     - stockAvailableQuantity += qty   (back to available)
        //     - stockissueCompleted    -= qty   (we are undoing a completion)
        const resItem = await this.itemModel.updateOne(
          {
            _id: itemId,
            stockissueCompleted: { $gte: qty }, // guard: never go negative
          },
          {
            $inc: {
              stockAvailableQuantity: +qty,
              stockissueCompleted: -qty,
            },
          },
          // { session }
        );
        if (resItem.matchedCount !== 1 || resItem.modifiedCount !== 1) {
          throw new Error('StoreItem counters would go negative');
        }

        // (c) SPIQ: decrease IssuedQuantity by qty (string counters)
        const spiqDoc = await this.spiqModel.findOne({
          itemId: itemHex,
          placeId: placeHex,
        }); // .session(session)
        if (!spiqDoc) {
          throw new Error('Place stock not found when updating SPIQ');
        }
        const curIssued = this.toInt(spiqDoc.IssuedQuantity);
        const curtotalQty = this.toInt(spiqDoc.totalQuantity);
        if (curIssued < qty) {
          throw new Error('SPIQ.IssuedQuantity would go negative');
        }
        spiqDoc.IssuedQuantity = this.toStr(curIssued - qty);
        spiqDoc.totalQuantity = this.toStr(curtotalQty + qty);
        await spiqDoc.save(); // { session }

        // (d) Movement: RETURN
        await this.movModel.create(
          {
            itemId,
            placeId,
            issueId,
            type: 'RETURN',
            qty,
            refNo: String(issueDoc.issNo ?? ''),
            operatedBy: opUser ?? new Types.ObjectId(issueDoc.createdBy),
            note: 'Return to stock (completed → available)',
          },
          // { session }
        );

        // (e) If the Issue was CLOSED but now no longer fully issued, reopen to APPROVED
        // const fresh = await this.issModel.findById(issueId).lean(); // .session(session)
        // const stillFullyIssued = (fresh?.lines ?? []).every(
        //   (l: any) => Number(l.issuedQty ?? 0) >= Number(l.approvedQty ?? 0),
        // );
        // if (!stillFullyIssued && fresh?.status === 'CLOSED') {
        //   await this.issModel.updateOne(
        //     { _id: issueId },
        //     {
        //       $set: {
        //         status: 'APPROVED',
        //         closedAt: undefined,
        //         closedBy: undefined,
        //       },
        //     },
        //     // { session }
        //   );
        // }

        // await session.commitTransaction();
      } catch (e) {
        // await session.abortTransaction();
        this.logger.error(`returnToStock tx failed: ${e?.message || e}`);
        return { msg: 'Return Item Failed.......', status: false };
      } finally {
        // session.endSession();
      }

      return { msg: 'Return Completed.......', status: true };
    } catch (e) {
      this.logger.error(`returnToStock failed: ${e?.message || e}`);
      return { msg: 'Return Item Failed.......', status: false };
    }
  }

  // Close an APPROVED Issue by releasing all remaining (approvedQty) back to stock.
  // Rules:
  // - IDs valid & exist.
  // - Issue must be APPROVED (already using the "approvedQty is remaining" model).
  // - For each line, let rem = approvedQty. If rem > 0,
  //     * StoreItem: stockAvailableQuantity += rem; stockIssueQuantity -= rem  (atomic guard)
  //     * Line: approvedQty = 0; returnQty = 0 (remaining goes to zero on close)
  // - If every line already has approvedQty == 0, we just mark CLOSED.
  // - Write an ADJUST movement per item (optional) to record the release of reservations.

  async closeIssue(dto: any) {
    try {
      const idRaw = String(dto?.id ?? '').trim();
      const userIdRaw = dto?.userId ? String(dto.userId).trim() : '';

      if (!isValidObjectId(idRaw)) {
        return { msg: 'Issue Item Failed.......', status: false };
      }
      if (userIdRaw && !isValidObjectId(userIdRaw)) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      const issueId = new Types.ObjectId(idRaw);
      const closer = userIdRaw ? new Types.ObjectId(userIdRaw) : undefined;

      // 1) Load issue
      const iss = await this.issModel
        .findById(issueId, { issNo: 1, status: 1, lines: 1, createdBy: 1 })
        .lean();

      if (!iss) {
        return { msg: 'Issue Item Failed.......', status: false };
      }
      if (iss.status !== 'APPROVED') {
        // Only APPROVED issues can be closed by releasing remaining reservations.
        // (If you want to allow CLOSING from DRAFT, change the check here.)
        return { msg: 'Issue Item Failed.......', status: false };
      }

      const lines = (iss.lines ?? []) as any[];
      if (lines.length === 0) {
        // no lines -> just close
        await this.issModel.updateOne(
          { _id: issueId },
          {
            $set: {
              status: 'CLOSED',
              closedAt: new Date(),
              ...(closer ? { closedBy: closer } : {}),
            },
          },
        );
        return { msg: 'Issue Closed.......', status: true };
      }

      // 2) Gather remaining per item
      type LineInfo = { idx: number; itemId: Types.ObjectId; approved: number };
      const remainPerLine: LineInfo[] = [];

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const itemId = l?.itemId ? new Types.ObjectId(l.itemId) : undefined;
        if (!itemId) {
          return { msg: 'Issue Item Failed.......', status: false };
        }
        const approvedQty = Number(l?.approvedQty ?? 0); // remaining
        if (!Number.isInteger(approvedQty) || approvedQty < 0) {
          return { msg: 'Issue Item Failed.......', status: false };
        }
        remainPerLine.push({ idx: i, itemId, approved: approvedQty });
      }

      const totalRemaining = remainPerLine.reduce((a, b) => a + b.approved, 0);

      // 3) If nothing remains, just close
      if (totalRemaining === 0) {
        await this.issModel.updateOne(
          { _id: issueId },
          {
            $set: {
              status: 'CLOSED',
              closedAt: new Date(),
              ...(closer ? { closedBy: closer } : {}),
            },
          },
        );
        return { msg: 'Issue Closed.......', status: true };
      }

      // 4) Validate items exist and we have enough reserved to release
      const itemIds = Array.from(
        new Set(remainPerLine.map((x) => x.itemId.toHexString())),
      ).map((h) => new Types.ObjectId(h));

      const items = await this.itemModel
        .find(
          { _id: { $in: itemIds } },
          { _id: 1, stockAvailableQuantity: 1, stockIssueQuantity: 1 },
        )
        .lean();

      if (items.length !== itemIds.length) {
        return { msg: 'Issue Item Failed.......', status: false };
      }

      const reservedByHex: Record<string, number> = {};
      for (const it of items) {
        reservedByHex[new Types.ObjectId(it._id).toHexString()] = Number(
          it.stockIssueQuantity ?? 0,
        );
      }

      // per-item sum of remaining
      const needPerItem: Record<string, number> = {};
      for (const r of remainPerLine) {
        const hex = r.itemId.toHexString();
        needPerItem[hex] = (needPerItem[hex] ?? 0) + r.approved;
      }

      for (const [hex, need] of Object.entries(needPerItem)) {
        if ((reservedByHex[hex] ?? 0) < need) {
          // You cannot release more than currently reserved
          return { msg: 'Issue Item Failed.......', status: false };
        }
      }

      // 5) Apply updates
      try {
        // (a) Release reserves on StoreItem
        for (const [hex, qty] of Object.entries(needPerItem)) {
          const res = await this.itemModel.updateOne(
            {
              _id: new Types.ObjectId(hex),
              stockIssueQuantity: { $gte: qty }, // guard: never negative
            },
            {
              $inc: {
                stockAvailableQuantity: +qty, // back to available
                stockIssueQuantity: -qty, // release reservation
              },
            },
          );
          if (res.matchedCount !== 1 || res.modifiedCount !== 1) {
            throw new Error('Reserved stock would go negative');
          }
        }

        // (b) Zero out remaining on lines (approvedQty -> 0; returnQty -> 0 to reflect no remaining)
        const setPaths: Record<string, any> = {};
        for (const r of remainPerLine) {
          if (r.approved > 0) {
            setPaths[`lines.${r.idx}.approvedQty`] = 0;
            // setPaths[`lines.${r.idx}.returnQty`] = 0;
          }
        }
        await this.issModel.updateOne(
          { _id: issueId },
          {
            $set: {
              ...setPaths,
              status: 'CLOSED',
              closedAt: new Date(),
              ...(closer ? { closedBy: closer } : {}),
            },
          },
        );

        // (c) Optional movement log per item for the release action
        const movements: any[] = [];
        for (const [hex, qty] of Object.entries(needPerItem)) {
          if (qty <= 0) continue;
          movements.push({
            itemId: new Types.ObjectId(hex),
            // placeId is unknown/global in this step
            type: 'ADJUST',
            qty: 0, // semantic: reservation release (no physical move)
            refNo: String(iss.issNo ?? ''),
            operatedBy: closer ?? new Types.ObjectId(iss.createdBy),
            note: `Issue close: release remaining ${qty} to available`,
            issueId: issueId,
          });
        }
        if (movements.length) {
          await this.movModel.insertMany(movements);
        }
      } catch (e) {
        this.logger.error(`closeIssue tx failed: ${e?.message || e}`);
        return { msg: 'Issue Item Failed.......', status: false };
      }

      return { msg: 'Issue Closed.......', status: true };
    } catch (e) {
      this.logger.error(`closeIssue failed: ${e?.message || e}`);
      return { msg: 'Issue Item Failed.......', status: false };
    }
  }
}
