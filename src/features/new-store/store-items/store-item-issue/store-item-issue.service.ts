// issue.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rack } from '../../locations/rack/entities/rack.schema';
import { StoreCategory } from '../store-category/entities/store-category.schema';
import { StoreNewItem } from '../store-item/entities/store-item.schema';
import { ItemIssueDocument } from './entities/store-item-issue.schema';
import {
  IssueOneLineDto,
  IssueBulkDto,
  ReturnLineDto,
  ReturnBulkDto,
} from './dto/create-store-item-issue.dto';
import { StockTrack } from '../store-item/entities/stock-track.schema';

// ✅ Adjust these imports/paths to your project
// If you have class-based schema:
/// import { StockTrack } from '../stock-track/entities/stock-stock-track.schema';

type StockTrackType =
  | 'CREATE'
  | 'APPROVED'
  | 'ISSUE'
  | 'RETURN'
  | 'SCRAP'
  | 'CLOSED';

@Injectable()
export class IssueService {
  constructor(
    @InjectModel('ItemIssue', 'store')
    private readonly issueModel: Model<ItemIssueDocument>,

    @InjectModel('StoreNewItem', 'store')
    private readonly itemModel: Model<StoreNewItem>,

    @InjectModel('StoreCategory', 'store')
    private readonly catModel: Model<StoreCategory>,

    @InjectModel('Rack', 'store')
    private readonly rackModel: Model<Rack>,

    // ✅ Stock Track model (change model name if yours differs)
    @InjectModel('StockTrack', 'store')
    private readonly stockTrackModel: Model<StockTrack>,
  ) {}

  private n(v: any, fb = 0) {
    const x = Number(v);
    return Number.isFinite(x) ? x : fb;
  }

  private oid(id: any) {
    const s = String(id || '').trim();
    if (!Types.ObjectId.isValid(s))
      throw new BadRequestException('Invalid ObjectId');
    return new Types.ObjectId(s);
  }

  private asOid(v: any) {
    if (!v) return null;
    if (v instanceof Types.ObjectId) return v;
    return this.oid(v);
  }

  private findLine(issue: ItemIssueDocument, itemId: string) {
    const idx = (issue.lines || []).findIndex(
      (l: any) => String(l.itemId) === String(itemId),
    );
    if (idx < 0) throw new BadRequestException('Line not found for itemId');
    return { line: issue.lines[idx] as any, idx };
  }

  private num(v: any, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  private clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
  }

  private computeCloseStatus(issue: any) {
    const lines = issue.lines || [];
    const anyApproved = lines.some((l: any) => this.n(l.approvedQty, 0) > 0);
    const allIssuedAgainstApproved = lines.every((l: any) => {
      const ap = this.n(l.approvedQty, 0);
      const isd = this.n(l.issuedQty, 0);
      return isd >= ap;
    });
    if (anyApproved && allIssuedAgainstApproved) return 'CLOSED';
    return 'APPROVED';
  }

  /* -------------------------------------------------------
     ✅ STOCK TRACK HELPERS
     ------------------------------------------------------- */

  private async track(params: {
    type: StockTrackType;
    qty: number; // recommended signed: ISSUE negative, RETURN positive, SCRAP negative
    operatedBy: string; // userId
    issue?: any; // issue doc
    item?: any; // store item doc (optional)
    itemId?: any;
    issueId?: any;
    refNo?: string;
    note?: string;
    rackId?: string;
  }) {
    const operatedBy = String(params.operatedBy || '').trim();
    if (!Types.ObjectId.isValid(operatedBy)) return;

    const issue = params.issue || null;
    const item = params.item || null;

    const issueId = params.issueId
      ? this.asOid(params.issueId)
      : issue?._id
        ? this.asOid(issue._id)
        : null;

    const itemId = params.itemId
      ? this.asOid(params.itemId)
      : item?._id
        ? this.asOid(item._id)
        : null;

    const rackId = params.rackId
      ? this.asOid(params.rackId)
      : item?._id
        ? this.asOid(item._id)
        : null;

    const refNo = params.refNo ?? (issue?.issNo ? String(issue.issNo) : '');

    // category/rack from item if present
    const categoryId = item?.categoryId ? this.asOid(item.categoryId) : null;
    // const rackId = item?.rackId ? this.asOid(item.rackId) : null;

    // Keep payload flexible — if your schema requires fields, enforce here.
    await this.stockTrackModel.create({
      type: params.type,
      qty: Number(params.qty || 0),
      operatedBy: this.oid(operatedBy),

      refNo,
      note: params.note ?? '',

      itemId,
      categoryId,
      rackId,

      issueId,
      receivingId: null,
    });
  }

  private async trackCloseIfChanged(
    prevStatus: string,
    issue: any,
    operatedBy: string,
  ) {
    const nextStatus = String(issue?.status || '').toUpperCase();
    if (prevStatus !== 'CLOSED' && nextStatus === 'CLOSED') {
      await this.track({
        type: 'CLOSED',
        qty: 0,
        operatedBy,
        issue,
        note: `Issue auto-closed (issNo=${issue?.issNo || ''})`,
      });
    }
  }

  /* -------------------------------------------------------
     (optional) if you ever use this, it now tracks ISSUE too
     ------------------------------------------------------- */
  private async deductStockOrThrow(itemId: string, qty: number) {
    const item = await this.itemModel.findById(this.oid(itemId));
    if (!item) throw new BadRequestException('Store item not found');

    const avail = this.n((item as any).stockAvailableQuantity, 0);
    if (qty > avail) {
      throw new BadRequestException(
        `Insufficient stock. Available=${avail}, requested=${qty}`,
      );
    }

    (item as any).stockAvailableQuantity = avail - qty;
    (item as any).stockIssueQuantity =
      this.n((item as any).stockIssueQuantity, 0) + qty;
    (item as any).stockissueCompleted =
      this.n((item as any).stockissueCompleted, 0) + qty;

    await item.save();

    // ✅ Track (ISSUE is negative movement)
    await this.track({
      type: 'ISSUE',
      qty: -qty,
      operatedBy: '', // if you store, else pass real userId from caller
      item,
      itemId: item._id,
      note: `deductStockOrThrow qty=${qty}`,
    });

    return {
      rackId: String((item as any).rackId),
      rackName: String((item as any).rackName ?? ''),
      itemName: String((item as any).itemName ?? ''),
    };
  }

  /* ---------------- A) SOURCES FOR UI ---------------- */

  async getIssueSourcesForSelectedItem(selectedItemId: string) {
    const item = await this.itemModel.findById(this.oid(selectedItemId)).lean();
    if (!item) throw new BadRequestException('Item not found');

    const itemNameOid = this.asOid((item as any).itemNameId);
    if (!itemNameOid) throw new BadRequestException('Item has no itemNameId');

    const parentCategoryOid = this.asOid((item as any).categoryId);
    const parentCategoryId = parentCategoryOid ? String(parentCategoryOid) : '';

    const children = parentCategoryOid
      ? await this.catModel
          .find({ parentId: parentCategoryOid })
          .select({ name: 1, parentId: 1 })
          .lean()
      : [];

    const childIds = children.map((c: any) => String(c._id));
    const allBucketIds = [
      ...(parentCategoryId ? [parentCategoryId] : []),
      ...childIds,
    ].filter(Boolean);

    const bucketOids = allBucketIds.map((x) => this.oid(x));

    const items = await this.itemModel
      .find({
        itemNameId: itemNameOid,
        ...(bucketOids.length ? { categoryId: { $in: bucketOids } } : {}),
      })
      .select({
        itemName: 1,
        itemNameCode: 1,
        unit: 1,
        categoryId: 1,
        rackId: 1,
        rackName: 1,
        stockAvailableQuantity: 1,
        totalStockQuantity: 1,
      })
      .lean();

    const byCat = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        available: number;
        itemIds: string[];
      }
    >();

    if (parentCategoryId) {
      byCat.set(parentCategoryId, {
        categoryId: parentCategoryId,
        categoryName: 'Category',
        available: 0,
        itemIds: [],
      });
    }

    for (const child of children) {
      byCat.set(String(child._id), {
        categoryId: String(child._id),
        categoryName: child.name ?? '',
        available: 0,
        itemIds: [],
      });
    }

    for (const it of items) {
      const cid = (it as any).categoryId ? String((it as any).categoryId) : '';
      const av = Number((it as any).stockAvailableQuantity || 0);

      if (cid && byCat.has(cid)) {
        const b = byCat.get(cid)!;
        b.available += av;
        b.itemIds.push(String((it as any)._id));
      }

      if (parentCategoryId && byCat.has(parentCategoryId)) {
        const p = byCat.get(parentCategoryId)!;
        p.available += av;
        p.itemIds.push(String((it as any)._id));
      }
    }

    if (parentCategoryOid) {
      const parent = await this.catModel.findById(parentCategoryOid).lean();
      const p = byCat.get(parentCategoryId);
      if (p) p.categoryName = parent?.name ?? 'Category';
    }

    const resultBuckets = Array.from(byCat.values())
      .filter((b) => b.available > 0 || b.categoryId === parentCategoryId)
      .sort(
        (a, b) =>
          (a.categoryId === parentCategoryId ? 1 : 0) -
          (b.categoryId === parentCategoryId ? 1 : 0),
      );

    return {
      selectedItemId: String((item as any)._id),
      itemNameId: String(itemNameOid),
      itemName: (item as any).itemName ?? '',
      itemNameCode: (item as any).itemNameCode ?? '',
      unit: (item as any).unit ?? '',
      parentCategoryId: parentCategoryId || null,
      buckets: resultBuckets,
    };
  }

  private async nextIssueNumber() {
    const n = Date.now().toString().slice(-6);
    return `ISS-${new Date().getFullYear()}-${n}`;
  }

  /* ---------------- CREATE DRAFT BULK ---------------- */

  async createDraftBulk(dto: any) {
    const createdBy = String(dto?.createdBy || '').trim();
    const reason = String(dto?.reason || '').trim();
    const remark = String(dto?.remark || '').trim();
    const lines = Array.isArray(dto?.lines) ? dto.lines : [];

    if (!Types.ObjectId.isValid(createdBy)) {
      throw new BadRequestException('createdBy invalid');
    }
    if (!lines.length) {
      throw new BadRequestException('lines required');
    }

    const merged = new Map<string, number>();
    for (const l of lines) {
      const itemId = String(l?.itemId || '').trim();
      const requestedQty = Number(l?.requestedQty || 0);

      if (!Types.ObjectId.isValid(itemId)) {
        throw new BadRequestException(`Invalid itemId: ${itemId}`);
      }
      if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
        throw new BadRequestException(
          `requestedQty must be > 0 for itemId: ${itemId}`,
        );
      }

      merged.set(itemId, (merged.get(itemId) ?? 0) + requestedQty);
    }

    const itemIds = [...merged.keys()].map((id) => this.oid(id));

    const items = await this.itemModel
      .find({ _id: { $in: itemIds } })
      .select({ itemName: 1, unit: 1, stockAvailableQuantity: 1 })
      .lean();

    if (items.length !== itemIds.length) {
      const found = new Set(items.map((x: any) => String(x._id)));
      const missing = [...merged.keys()].filter((id) => !found.has(id));
      throw new BadRequestException(
        `Some items not found: ${missing.join(', ')}`,
      );
    }

    const issueLines = items.map((it: any) => {
      const id = String(it._id);
      const qty = merged.get(id)!;
      const avail = Number(it.stockAvailableQuantity || 0);

      if (qty > avail) {
        throw new BadRequestException(
          `Insufficient stock for ${it.itemName ?? id}. Requested ${qty}, available ${avail}`,
        );
      }

      return {
        itemId: this.oid(id),
        itemName: String(it.itemName || '').trim(),
        requestedQty: qty,
        approvedQty: 0,
        issuedQty: 0,
        returnQty: 0,
        scrapQty: 0,
        unit: String(it.unit || '').trim(),
      };
    });

    const issNo = await this.nextIssueNumber();

    const issue = await this.issueModel.create({
      issNo,
      reason,
      remark,
      status: 'DRAFT',
      createdBy: this.oid(createdBy),
      lines: issueLines,
      allocations: [],
    });

    // ✅ Track CREATE
    await this.track({
      type: 'CREATE',
      qty: 0,
      operatedBy: createdBy,
      issue,
      issueId: issue._id,
      refNo: issNo,
      note: `Draft created (bulk) lines=${issueLines.length}`,
    });

    return {
      _id: String(issue._id),
      issNo,
      linesCount: issueLines.length,
    };
  }

  /* ---------------- CREATE DRAFT FROM SELECTED ITEM ---------------- */

  async createDraftFromSelectedItem(dto: any) {
    const selectedItemId = String(dto?.itemId || '').trim();
    const requestedQty = Number(dto?.requestedQty || 0);
    const createdBy = String(dto?.createdBy || '').trim();
    const chosenSubCategoryId = String(dto?.subCategoryId || '').trim();

    if (!selectedItemId) throw new BadRequestException('itemId required');
    if (!Types.ObjectId.isValid(createdBy))
      throw new BadRequestException('createdBy invalid');
    if (!Number.isFinite(requestedQty) || requestedQty <= 0)
      throw new BadRequestException('requestedQty must be > 0');

    const sources = await this.getIssueSourcesForSelectedItem(selectedItemId);

    let bucket: any = null;

    if (chosenSubCategoryId && sources.buckets?.length) {
      bucket =
        sources.buckets.find(
          (b: any) => b.categoryId === chosenSubCategoryId && b.available > 0,
        ) ?? null;
    }

    if (!bucket) {
      bucket =
        sources.buckets.find(
          (b: any) =>
            b.categoryId !== sources.parentCategoryId && b.available > 0,
        ) ??
        sources.buckets.find(
          (b: any) =>
            b.categoryId === sources.parentCategoryId && b.available > 0,
        ) ??
        null;
    }

    if (!bucket)
      throw new BadRequestException('No stock available for this item');

    const representativeItemId = bucket.itemIds?.[0];
    if (!representativeItemId)
      throw new BadRequestException('No item mapping found in selected bucket');

    const issNo = await this.nextIssueNumber();

    const issue = await this.issueModel.create({
      issNo,
      reason: String(dto?.reason || '').trim(),
      remark: String(dto?.remark || '').trim(),
      status: 'DRAFT',
      createdBy: this.oid(createdBy),
      lines: [
        {
          itemId: this.oid(representativeItemId),
          itemName: `${sources.itemName}`.trim(),
          requestedQty,
          approvedQty: 0,
          issuedQty: 0,
          returnQty: 0,
          scrapQty: 0,
          unit: sources.unit ?? '',
        },
      ],
      allocations: [],
    });

    // ✅ Track CREATE
    await this.track({
      type: 'CREATE',
      qty: 0,
      operatedBy: createdBy,
      issue,
      issueId: issue._id,
      refNo: issNo,
      note: `Draft created (selected item) requestedQty=${requestedQty}`,
    });

    return {
      _id: String(issue._id),
      issNo,
      chosenBucket: {
        categoryId: bucket.categoryId,
        categoryName: bucket.categoryName,
        available: bucket.available,
      },
    };
  }

  /* ---------------- APPROVE HEADER (single-line issues) ---------------- */

  async approveIssue(issueId: string, dto: any) {
    const approvedBy = String(dto?.approvedBy || '').trim();
    if (!Types.ObjectId.isValid(approvedBy))
      throw new BadRequestException('approvedBy invalid');

    const issue = await this.issueModel.findById(this.oid(issueId));
    if (!issue) throw new BadRequestException('Issue not found');
    // if (String(issue.status).toUpperCase() !== 'DRAFT')
    //   throw new BadRequestException('Only DRAFT can be approved');
    if (!issue.lines?.length) throw new BadRequestException('No lines');

    const line: any = issue.lines[0];
    const requestedQty = Number(line.requestedQty || 0);

    let approvedQty = Number(dto?.approvedQty ?? requestedQty);
    let approvedRejectQty = Number(dto?.approvedRejectQty ?? 0);
    if (!Number.isFinite(approvedQty) || approvedQty <= 0)
      approvedQty = requestedQty;
    if (approvedQty > requestedQty) approvedQty = requestedQty;

    line.approvedQty = approvedQty;
    line.approvedRejectQty = approvedRejectQty;

    // issue.status = 'APPROVED';
    (issue as any).approvedBy = this.oid(approvedBy);
    (issue as any).approvedAt = new Date();

    issue.markModified('lines');
    await issue.save();

    // ✅ Track APPROVED
    await this.track({
      type: 'APPROVED',
      qty: 0,
      operatedBy: approvedBy,
      issue,
      note: `Header approved approvedQty=${approvedQty}`,
    });

    return true;
  }

  /* ---------------- APPROVE ONE LINE ---------------- */

  async approveIssueLine(issueId: string, itemIds: string, dto: any) {
    const approvedBy = String(dto?.approvedBy || '').trim();
    const itemId = String(itemIds || '').trim();
    const mode = String(dto?.mode || 'add').toLowerCase() as 'add' | 'set';

    if (!Types.ObjectId.isValid(approvedBy)) {
      throw new BadRequestException('approvedBy invalid');
    }
    if (!Types.ObjectId.isValid(itemId)) {
      throw new BadRequestException('itemId invalid');
    }

    const issue = await this.issueModel.findById(this.oid(issueId));
    if (!issue) throw new BadRequestException('Issue not found');
    // if (String(issue.status).toUpperCase() !== 'DRAFT')
    //   throw new BadRequestException('Only DRAFT can be approved');
    const storeItem = await this.itemModel.findById(this.oid(itemId));
    if (!storeItem) throw new BadRequestException('Store item not found');

    const idx = (issue.lines || []).findIndex(
      (l: any) => String(l.itemId) === itemId,
    );
    if (idx < 0) throw new BadRequestException('Line not found for itemId');

    const line: any = issue.lines[idx];
    const requested = this.num(line.requestedQty, 0);
    const prevApproved = this.num(line.approvedQty, 0);
    const prevRejected = this.num(line.approvedRejectQty, 0);
    if (!Number.isFinite(requested) || requested <= 0) {
      throw new BadRequestException('Invalid requestedQty on line');
    }

    const incomingQty = this.num(
      dto?.approvedQty,
      mode === 'add' ? 0 : prevApproved,
    );
    const approvedRejectQty = this.num(
      dto?.approvedRejectQty,
      mode === 'add' ? 0 : prevRejected,
    );

    if (mode === 'add' && incomingQty <= 0) {
      throw new BadRequestException('approvedQty must be > 0 for add');
    }
    if (mode === 'set' && incomingQty < 0) {
      throw new BadRequestException('approvedQty cannot be negative');
    }

    const totalApprovedAndRejected =
      prevApproved + incomingQty + prevRejected + approvedRejectQty;
    if (requested < totalApprovedAndRejected) {
      throw new BadRequestException(
        'Requested quantity cannot be less than the sum of approved, incoming, previous rejected, and reject quantities',
      );
    }
    const avail = Number((storeItem as any).stockAvailableQuantity || 0);
    (storeItem as any).stockAvailableQuantity = avail + approvedRejectQty;

    await storeItem.save();

    const nextApproved =
      mode === 'set'
        ? this.clamp(
            incomingQty,
            0,
            requested - prevRejected - approvedRejectQty,
          ) // Ensure we don't approve more than remaining after previous rejects
        : this.clamp(
            prevApproved + incomingQty,
            0,
            requested - prevRejected - approvedRejectQty,
          );

    line.approvedQty = nextApproved;
    line.approvedRejectQty = prevRejected + approvedRejectQty;

    (issue as any).approvedBy = this.oid(approvedBy);
    (issue as any).approvedAt = new Date();

    const allApproved = (issue.lines || []).every((x: any) => {
      const rq = this.num(x.requestedQty, 0);
      const aq = this.num(x.approvedQty, 0);
      return rq > 0 && aq >= rq;
    });
    // issue.status = allApproved ? 'APPROVED' : 'DRAFT';

    issue.markModified('lines');
    await issue.save();

    // ✅ Track APPROVED
    await this.track({
      type: 'APPROVED',
      qty: 0,
      operatedBy: approvedBy,
      issue,
      note: `Approve line itemId=${itemId} approvedQty=${nextApproved} mode=${mode}`,
    });

    return {
      issueId: String(issue._id),
      issNo: (issue as any).issNo,
      // status: issue.status,
      updatedLine: {
        itemId: String(line.itemId),
        requestedQty: requested,
        approvedQty: nextApproved,
        remainingQty: Math.max(0, requested - nextApproved),
      },
    };
  }

  /* ---------------- APPROVE BULK ---------------- */

  async approveIssueBulk(issueId: string, dto: any) {
    const approvedBy = String(dto?.approvedBy || '').trim();
    if (!Types.ObjectId.isValid(approvedBy))
      throw new BadRequestException('approvedBy invalid');

    const issue = await this.issueModel.findById(this.oid(issueId));
    if (!issue) throw new BadRequestException('Issue not found');
    // if (String(issue.status).toUpperCase() !== 'DRAFT')
    //   throw new BadRequestException('Only DRAFT can be approved');

    const updates = Array.isArray(dto?.lines) ? dto.lines : [];
    if (!updates.length) throw new BadRequestException('lines required');

    const updatedLines: any[] = [];

    for (const u of updates) {
      const itemId = String(u?.itemId || '').trim();
      const mode = String(u?.mode || 'add').toLowerCase() as 'add' | 'set';
      if (!Types.ObjectId.isValid(itemId)) continue;

      const idx = (issue.lines || []).findIndex(
        (l: any) => String(l.itemId) === itemId,
      );
      if (idx < 0) continue;

      const line: any = issue.lines[idx];
      const requested = this.num(line.requestedQty, 0);
      const prevApproved = this.num(line.approvedQty, 0);
      if (requested <= 0) continue;

      const incomingQty = this.num(u?.approvedQty, 0);

      const nextApproved =
        mode === 'set'
          ? this.clamp(incomingQty, 0, requested)
          : this.clamp(prevApproved + incomingQty, 0, requested);

      line.approvedQty = nextApproved;

      updatedLines.push({
        itemId: String(line.itemId),
        requestedQty: requested,
        approvedQty: nextApproved,
        remainingQty: Math.max(0, requested - nextApproved),
      });
    }

    (issue as any).approvedBy = this.oid(approvedBy);
    (issue as any).approvedAt = new Date();

    const allApproved = (issue.lines || []).every((x: any) => {
      const rq = this.num(x.requestedQty, 0);
      const aq = this.num(x.approvedQty, 0);
      return rq > 0 && aq >= rq;
    });
    // issue.status = allApproved ? 'APPROVED' : 'DRAFT';

    issue.markModified('lines');
    await issue.save();

    // ✅ Track APPROVED
    await this.track({
      type: 'APPROVED',
      qty: 0,
      operatedBy: approvedBy,
      issue,
      note: `Approve bulk updatedLines=${updatedLines.length}`,
    });

    return {
      issueId: String(issue._id),
      issNo: (issue as any).issNo,
      // status: issue.status,
      updatedLines,
    };
  }

  /* ---------------- ISSUE ONE LINE ---------------- */

  async issueLine(issueId: string, dto: any) {
    console.log(dto);
    const issuedBy = String(dto.issuedBy || '').trim();
    const itemId = String(dto.itemId || '').trim();
    const qty = Number(dto.qty || 0);
    const reject = Number(dto.issuedRejectQty || 0);

    if (!Types.ObjectId.isValid(issuedBy))
      throw new BadRequestException('issuedBy invalid');
    if (!Types.ObjectId.isValid(itemId))
      throw new BadRequestException('itemId invalid');
    if (!Number.isFinite(qty) || qty <= 0)
      throw new BadRequestException('qty invalid');
    if (!Number.isFinite(reject) || reject < 0)
      throw new BadRequestException('qty invalid');

    const issue = await this.issueModel.findById(this.oid(issueId));
    if (!issue) throw new BadRequestException('Issue not found');
    // if (String(issue.status).toUpperCase() !== 'APPROVED')
    //   throw new BadRequestException('Only APPROVED can be issued');

    // const prevStatus = String(issue.status || '').toUpperCase();

    const { line } = this.findLine(issue, itemId);

    const approvedQty = Number((line as any).approvedQty || 0);
    const issuedQty = Number((line as any).issuedQty || 0);
    const issuedRejectQty = Number((line as any).issuedRejectQty || 0);
    const canIssue = approvedQty - issuedQty - issuedRejectQty;

    if (canIssue <= 0)
      throw new BadRequestException('Nothing approved to issue for this item');
    if (qty > canIssue)
      throw new BadRequestException(
        `Qty exceeds approved remaining (${canIssue})`,
      );
    if (reject > canIssue)
      throw new BadRequestException(
        'Reject quantity exceeds approved quantity',
      );
    const storeItem = await this.itemModel.findById(this.oid(itemId));
    if (!storeItem) throw new BadRequestException('Store item not found');

    const avail = Number((storeItem as any).stockAvailableQuantity || 0);
    if (avail < qty)
      throw new BadRequestException(`Insufficient stock. Available: ${avail}`);
    var adddata = avail - qty;
    // ✅ stock updates
    (storeItem as any).stockAvailableQuantity = adddata + reject;
    (storeItem as any).stockIssueQuantity =
      Number((storeItem as any).stockIssueQuantity || 0) + qty;

    await storeItem.save();

    // ✅ issue line updates
    (line as any).issuedQty = issuedQty + qty;
    (line as any).issuedRejectQty = issuedRejectQty + reject;

    issue.allocations = issue.allocations || [];
    if (dto.rackId != '') {
      const storeRack = await this.rackModel.findById(this.oid(dto.rackId));

      if (storeRack) {
        // ✅ allocation log
        issue.allocations = issue.allocations || [];

        const rackOid = this.oid((storeRack as any)._id);
        const itemOid = this.oid(itemId);

        // find existing allocation for same rack + same item
        const existingIdx = issue.allocations.findIndex((a: any) => {
          return (
            String(a.rackId) === String(rackOid) &&
            String(a.itemId) === String(itemOid)
          );
        });

        if (existingIdx >= 0) {
          // ✅ add qty into existing allocation
          const prevQty = Number(issue.allocations[existingIdx].qty || 0);
          issue.allocations[existingIdx].qty = prevQty + qty;

          // optional: keep latest audit fields
          issue.allocations[existingIdx].issuedAt = new Date();
          issue.allocations[existingIdx].issuedBy = issuedBy;
        } else {
          // ✅ create new allocation
          issue.allocations.push({
            itemId: itemOid,
            itemName: (storeItem as any).itemName || (line as any).itemName,
            rackId: rackOid,
            rackName: (storeRack as any).code || '',
            qty,
            returnedQty: 0,
            returnedGoodQty: 0,
            returnedScrapQty: 0,
            issuedAt: new Date(),
            issuedBy: this.oid(issuedBy),
          } as any);
        }
      }
    }
    // ✅ auto close if fully issued
    // issue.status = this.computeCloseStatus(issue);
    if (
      // String(issue.status).toUpperCase() === 'CLOSED' &&
      !(issue as any).closedAt
    ) {
      (issue as any).closedAt = new Date();
    }

    issue.markModified('lines');
    issue.markModified('allocations');
    await issue.save();

    // ✅ Track ISSUE (recommended signed negative)
    await this.track({
      rackId: dto.rackId,
      type: 'ISSUE',
      qty: -qty,
      operatedBy: issuedBy,
      issue,
      item: storeItem,
      note: `Issue line itemId=${itemId} qty=${qty}`,
    });

    // ✅ Track CLOSED if changed
    // await this.trackCloseIfChanged(prevStatus, issue, issuedBy);

    return {
      updatedLine: {
        itemId: String((line as any).itemId),
        issuedQty: Number((line as any).issuedQty || 0),
        approvedQty: Number((line as any).approvedQty || 0),
        returnQty: Number((line as any).returnQty || 0),
        scrapQty: Number((line as any).scrapQty || 0),
      },
      // status: issue.status,
    };
  }

  /* ---------------- ISSUE BULK ---------------- */

  async issueBulk(issueId: string, dto: IssueBulkDto) {
    const issuedBy = String(dto.issuedBy || '').trim();
    if (!Types.ObjectId.isValid(issuedBy))
      throw new BadRequestException('issuedBy invalid');

    const lines = Array.isArray(dto.lines) ? dto.lines : [];
    if (!lines.length) throw new BadRequestException('No lines');

    const issue = await this.issueModel.findById(this.oid(issueId));
    if (!issue) throw new BadRequestException('Issue not found');
    // if (String(issue.status).toUpperCase() !== 'APPROVED')
    //   throw new BadRequestException('Only APPROVED can be issued');

    // const prevStatus = String(issue.status || '').toUpperCase();
    const updated: any[] = [];

    for (const l of lines) {
      const itemId = String((l as any).itemId || '').trim();
      const qty = Number((l as any).qty || 0);

      if (!Types.ObjectId.isValid(itemId))
        throw new BadRequestException('itemId invalid');
      if (!Number.isFinite(qty) || qty <= 0)
        throw new BadRequestException('qty invalid');

      const { line } = this.findLine(issue, itemId);

      const approvedQty = Number((line as any).approvedQty || 0);
      const issuedQty = Number((line as any).issuedQty || 0);
      const canIssue = approvedQty - issuedQty;

      if (qty > canIssue)
        throw new BadRequestException(
          `Qty exceeds approved remaining for ${(line as any).itemName}`,
        );

      const storeItem = await this.itemModel.findById(this.oid(itemId));
      if (!storeItem) throw new BadRequestException('Store item not found');

      const avail = Number((storeItem as any).stockAvailableQuantity || 0);
      if (avail < qty)
        throw new BadRequestException(
          `Insufficient stock for ${(line as any).itemName}. Available: ${avail}`,
        );

      (storeItem as any).stockAvailableQuantity = avail - qty;
      (storeItem as any).stockIssueQuantity =
        Number((storeItem as any).stockIssueQuantity || 0) + qty;

      await storeItem.save();

      (line as any).issuedQty = issuedQty + qty;

      issue.allocations = issue.allocations || [];
      issue.allocations.push({
        itemId: this.oid(itemId),
        itemName: (storeItem as any).itemName || (line as any).itemName,
        rackId: (storeItem as any).rackId,
        rackName: (storeItem as any).rackName || '',
        qty,
        returnedQty: 0,
        returnedGoodQty: 0,
        returnedScrapQty: 0,
        issuedAt: new Date(),
        issuedBy: this.oid(issuedBy),
      } as any);

      // ✅ Track ISSUE per line
      await this.track({
        type: 'ISSUE',
        qty: -qty,
        operatedBy: issuedBy,
        issue,
        item: storeItem,
        note: `Issue bulk itemId=${itemId} qty=${qty}`,
      });

      updated.push({ itemId, issuedQty: (line as any).issuedQty });
    }

    // issue.status = this.computeCloseStatus(issue);
    if (
      // String(issue.status).toUpperCase() === 'CLOSED' &&
      !(issue as any).closedAt
    ) {
      (issue as any).closedAt = new Date();
    }

    issue.markModified('lines');
    issue.markModified('allocations');
    await issue.save();

    // ✅ Track CLOSED if changed
    // await this.trackCloseIfChanged(prevStatus, issue, issuedBy);

    return {
      updatedLines: updated,
      //  status: issue.status
    };
  }

  /* ---------------- RETURN LINE (good + scrap) ---------------- */

  async returnLine(issueId: string, dto: any) {
    console.log(dto);

    const returnedBy = String(dto.returnedBy || '').trim();
    const itemId = String(dto.itemId || '').trim();
    const scrapRackId = String(dto.scrapRackId || '').trim();

    const goodQty = Number(dto.goodQty ?? 0);
    const scrapQty = Number(dto.scrapQty ?? 0);
    const total = goodQty + scrapQty;

    if (!Types.ObjectId.isValid(issueId))
      throw new BadRequestException('issueId invalid');
    if (!Types.ObjectId.isValid(returnedBy))
      throw new BadRequestException('returnedBy invalid');
    if (!Types.ObjectId.isValid(itemId))
      throw new BadRequestException('itemId invalid');

    if (!Number.isFinite(goodQty) || goodQty < 0)
      throw new BadRequestException('goodQty invalid');
    if (!Number.isFinite(scrapQty) || scrapQty < 0)
      throw new BadRequestException('scrapQty invalid');
    if (total <= 0) throw new BadRequestException('Nothing to return');

    const issue = await this.issueModel.findById(this.oid(issueId));
    if (!issue) throw new BadRequestException('Issue not found');

    // const st = String(issue.status || '')
    //   .trim()
    //   .toUpperCase();
    // if (st !== 'CLOSED') {
    //   throw new BadRequestException('Only CLOSED issues can be returned');
    // }

    const lineIndex = (issue.lines || []).findIndex(
      (l: any) => String(l.itemId) === String(itemId),
    );
    if (lineIndex < 0) throw new BadRequestException('Issue line not found');

    const line: any = issue.lines[lineIndex];

    const approvedQty = Number(line.approvedQty || 0);
    const issuedQty = Number(line.issuedQty || 0);
    const prevReturnQty = Number(line.returnQty || 0);
    const prevScrapQty = Number(line.scrapQty || 0);

    if (issuedQty < prevReturnQty + prevScrapQty) {
      throw new BadRequestException(
        `Corrupt line: issuedQty(${issuedQty}) < returned+scrap(${prevReturnQty + prevScrapQty})`,
      );
    }
    if (approvedQty < issuedQty) {
      throw new BadRequestException(
        `Corrupt line: approvedQty(${approvedQty}) < issuedQty(${issuedQty})`,
      );
    }

    const remainingToReturn = issuedQty - prevReturnQty - prevScrapQty;
    if (remainingToReturn <= 0) {
      throw new BadRequestException('Nothing pending to return');
    }
    if (total > remainingToReturn) {
      throw new BadRequestException(
        `Return exceeds remaining (${remainingToReturn})`,
      );
    }

    // ✅ 1) Update ISSUE first
    const nextReturnQty = prevReturnQty + goodQty;
    const nextScrapQty = prevScrapQty + scrapQty;

    if (issuedQty < nextReturnQty + nextScrapQty) {
      throw new BadRequestException(
        `Invalid return: issuedQty(${issuedQty}) < nextReturned+nextScrap(${nextReturnQty + nextScrapQty})`,
      );
    }

    // line.issuedQty = issuedQty;
    line.returnQty = nextReturnQty;
    line.scrapQty = nextScrapQty;

    // ✅ 2) allocations FIFO update
    let needTotal = total;
    let needGood = goodQty;
    let needScrap = scrapQty;

    for (const a of issue.allocations || []) {
      if (needTotal <= 0) break;
      if (String((a as any).itemId) !== String(itemId)) continue;

      const aq = Number((a as any).qty || 0);
      const ar = Number((a as any).returnedQty || 0);
      const free = aq - ar;
      if (free <= 0) continue;

      const take = Math.min(needTotal, free);

      (a as any).returnedQty = ar + take;

      const takeGood = Math.min(needGood, take);
      const takeScrap = Math.min(needScrap, take - takeGood);

      (a as any).returnedGoodQty =
        Number((a as any).returnedGoodQty || 0) + takeGood;
      (a as any).returnedScrapQty =
        Number((a as any).returnedScrapQty || 0) + takeScrap;

      needTotal -= take;
      needGood -= takeGood;
      needScrap -= takeScrap;
    }

    issue.markModified('lines');
    issue.markModified('allocations');
    await issue.save();

    // ✅ 3) Now update STOCK
    const storeItem = await this.itemModel.findById(this.oid(itemId));
    if (!storeItem) throw new BadRequestException('Store item not found');

    const prevIssueStock = Number((storeItem as any).stockIssueQuantity || 0);
    (storeItem as any).stockIssueQuantity = Math.max(0, prevIssueStock - total);

    (storeItem as any).stockAvailableQuantity =
      Number((storeItem as any).stockAvailableQuantity || 0) + goodQty;

    (storeItem as any).stockscrapQuantity =
      Number((storeItem as any).stockscrapQuantity || 0) + scrapQty;

    await storeItem.save();

    if (scrapQty > 0) {
      const scrapRack = await this.rackModel.findById(this.oid(scrapRackId));
      if (!issue) throw new BadRequestException('Issue not found');

      const scrapItem = await this.itemModel.findById(
        this.oid(scrapRack?.itemId),
      );
      if (!scrapItem) throw new BadRequestException('Issue not found');
      if (scrapRack?.itemId != dto.itemId) {
        (scrapItem as any).totalStockQuantity =
          Number((scrapItem as any).totalStockQuantity || 0) + scrapQty;
        (scrapItem as any).stockAvailableQuantity =
          Number((scrapItem as any).stockAvailableQuantity || 0) + scrapQty;
        await scrapItem.save();
      }
    }

    // ✅ Track RETURN / SCRAP
    if (goodQty > 0) {
      await this.track({
        type: 'RETURN',
        qty: +goodQty,
        operatedBy: returnedBy,
        issue,
        item: storeItem,
        note: `Return goodQty=${goodQty}`,
      });
    }
    if (scrapQty > 0) {
      await this.track({
        type: 'SCRAP',
        qty: -scrapQty,
        operatedBy: returnedBy,
        issue,
        item: storeItem,
        note: `Return scrapQty=${scrapQty}`,
      });
    }

    const out = {
      updatedLine: {
        itemId: String(line.itemId),
        approvedQty: Number(line.approvedQty || 0),
        issuedQty: Number(line.issuedQty || 0),
        returnQty: Number(line.returnQty || 0),
        scrapQty: Number(line.scrapQty || 0),
      },
    };

    return { data: out };
  }

  /* ---------------- RETURN BULK ---------------- */

  async returnBulk(issueId: string, dto: any) {
    const returnedBy = String(dto.returnedBy || '').trim();
    if (!Types.ObjectId.isValid(returnedBy))
      throw new BadRequestException('returnedBy invalid');

    const lines = Array.isArray(dto.lines) ? dto.lines : [];
    if (!lines.length) throw new BadRequestException('No lines');

    const issue = await this.issueModel.findById(this.oid(issueId));
    if (!issue) throw new BadRequestException('Issue not found');

    // ✅ FIX: must be CLOSED (consistent with returnLine)
    // if (String(issue.status).toUpperCase() !== 'CLOSED')
    //   throw new BadRequestException('Only CLOSED can be returned');

    const updated: any[] = [];

    for (const l of lines) {
      const itemId = String(l.itemId || '').trim();
      const goodQty = Number(l.goodQty ?? 0);
      const scrapQty = Number(l.scrapQty ?? 0);
      const total = goodQty + scrapQty;

      if (!Types.ObjectId.isValid(itemId))
        throw new BadRequestException('itemId invalid');
      if (!Number.isFinite(goodQty) || goodQty < 0)
        throw new BadRequestException('goodQty invalid');
      if (!Number.isFinite(scrapQty) || scrapQty < 0)
        throw new BadRequestException('scrapQty invalid');
      if (total <= 0) continue;

      const { line } = this.findLine(issue, itemId);

      const issuedQty = Number((line as any).issuedQty || 0);
      const returnedGood = Number((line as any).returnQty || 0);
      const returnedScrap = Number((line as any).scrapQty || 0);
      const remainingToReturn = issuedQty - returnedGood - returnedScrap;

      if (total > remainingToReturn)
        throw new BadRequestException(
          `Return exceeds remaining for ${(line as any).itemName}`,
        );

      // 1) update ISSUE line
      (line as any).returnQty = returnedGood + goodQty;
      (line as any).scrapQty = returnedScrap + scrapQty;

      // 2) update stock
      const storeItem = await this.itemModel.findById(this.oid(itemId));
      if (!storeItem) throw new BadRequestException('Store item not found');

      const prevIssueStock = Number((storeItem as any).stockIssueQuantity || 0);
      (storeItem as any).stockIssueQuantity = Math.max(
        0,
        prevIssueStock - total,
      );

      (storeItem as any).stockAvailableQuantity =
        Number((storeItem as any).stockAvailableQuantity || 0) + goodQty;

      (storeItem as any).stockscrapQuantity =
        Number((storeItem as any).stockscrapQuantity || 0) + scrapQty;

      await storeItem.save();

      // ✅ Track RETURN / SCRAP per line
      if (goodQty > 0) {
        await this.track({
          type: 'RETURN',
          qty: +goodQty,
          operatedBy: returnedBy,
          issue,
          item: storeItem,
          note: `Return bulk goodQty=${goodQty}`,
        });
      }
      if (scrapQty > 0) {
        await this.track({
          type: 'SCRAP',
          qty: -scrapQty,
          operatedBy: returnedBy,
          issue,
          item: storeItem,
          note: `Return bulk scrapQty=${scrapQty}`,
        });
      }

      updated.push({
        itemId,
        returnQty: (line as any).returnQty,
        scrapQty: (line as any).scrapQty,
      });
    }

    issue.markModified('lines');
    await issue.save();

    return { updatedLines: updated };
  }

  /* ---------------- ISSUE APPROVED (bucket distribution) ---------------- */

  async issueApproved(issueId: string, dto: any) {
    const issuedBy = String(dto?.issuedBy || '').trim();
    if (issuedBy && !Types.ObjectId.isValid(issuedBy))
      throw new BadRequestException('issuedBy invalid');

    const issue = await this.issueModel.findById(this.oid(issueId));
    if (!issue) throw new BadRequestException('Issue not found');
    // if (String(issue.status).toUpperCase() !== 'APPROVED')
    //   throw new BadRequestException('Only APPROVED can be issued');

    // const prevStatus = String(issue.status || '').toUpperCase();

    const line: any = issue.lines?.[0];
    if (!line) throw new BadRequestException('No issue line');

    const need = Number(line.approvedQty || 0);
    if (need <= 0) throw new BadRequestException('approvedQty is 0');

    const repItem = await this.itemModel.findById(line.itemId).lean();
    if (!repItem) throw new BadRequestException('Line item not found');

    const bucketCategoryId = String(dto?.bucketCategoryId || '').trim();
    if (!bucketCategoryId)
      throw new BadRequestException('bucketCategoryId required for issuing');

    const candidates = await this.itemModel
      .find({
        itemNameId: (repItem as any).itemNameId,
        categoryId: this.oid(bucketCategoryId),
        stockAvailableQuantity: { $gt: 0 },
      })
      .select({
        categoryId: 1,
        rackId: 1,
        rackName: 1,
        itemName: 1,
        stockAvailableQuantity: 1,
        stockIssueQuantity: 1,
      })
      .sort({ stockAvailableQuantity: -1 })
      .lean();

    if (!candidates.length)
      throw new BadRequestException('No stock in selected category bucket');

    let remaining = need;
    const allocations: any[] = [];

    for (const it of candidates) {
      if (remaining <= 0) break;

      const av = Number((it as any).stockAvailableQuantity || 0);
      if (av <= 0) continue;

      const take = Math.min(av, remaining);

      await this.itemModel.updateOne(
        { _id: (it as any)._id },
        {
          $inc: {
            stockAvailableQuantity: -take,
            stockIssueQuantity: take,
          },
        },
      );

      allocations.push({
        itemId: (it as any)._id,
        itemName: (it as any).itemName ?? '',
        rackId: (it as any).rackId,
        rackName: (it as any).rackName ?? '',
        qty: take,
        returnedQty: 0,
        returnedGoodQty: 0,
        returnedScrapQty: 0,
        issuedAt: new Date(),
        issuedBy: issuedBy ? this.oid(issuedBy) : undefined,
      });

      // ✅ Track ISSUE per allocation (ISSUE negative)
      if (issuedBy) {
        await this.track({
          type: 'ISSUE',
          qty: -take,
          operatedBy: issuedBy,
          issue,
          item: it,
          itemId: (it as any)._id,
          note: `IssueApproved bucket=${bucketCategoryId} take=${take}`,
        });
      }

      remaining -= take;
    }

    const issuedTotal = need - remaining;
    if (issuedTotal <= 0)
      throw new BadRequestException('Not enough stock to issue');

    line.issuedQty = Number(line.issuedQty || 0) + issuedTotal;
    issue.allocations = [...(issue.allocations || []), ...allocations];

    // issue.status = this.computeCloseStatus(issue);
    if (
      // String(issue.status).toUpperCase() === 'CLOSED' &&
      !(issue as any).closedAt
    ) {
      (issue as any).closedAt = new Date();
    }

    issue.markModified('lines');
    issue.markModified('allocations');
    await issue.save();

    // ✅ Track CLOSED if changed
    if (issuedBy) {
      // await this.trackCloseIfChanged(prevStatus, issue, issuedBy);
    }

    return { issuedTotal, remaining };
  }

  /* ---------------- RETURN AGAINST ALLOCATION ---------------- */

  async returnAgainstAllocation(issueId: string, dto: any) {
    const allocationId = String(dto?.allocationId || '').trim();
    const qty = Number(dto?.qty || 0);
    const returnedBy = String(dto?.returnedBy || '').trim(); // ✅ add from UI

    if (!allocationId || !Types.ObjectId.isValid(allocationId))
      throw new BadRequestException('allocationId invalid');
    if (!Number.isFinite(qty) || qty <= 0)
      throw new BadRequestException('qty must be > 0');
    if (returnedBy && !Types.ObjectId.isValid(returnedBy))
      throw new BadRequestException('returnedBy invalid');

    const issue = await this.issueModel.findById(this.oid(issueId));
    if (!issue) throw new BadRequestException('Issue not found');
    if (!issue.allocations?.length)
      throw new BadRequestException('No allocations found');

    // const prevStatus = String(issue.status || '').toUpperCase();

    const alloc: any = issue.allocations.find(
      (a: any) => String(a._id) === allocationId,
    );
    if (!alloc) throw new BadRequestException('Allocation not found');

    const maxReturn = Number(alloc.qty || 0) - Number(alloc.returnedQty || 0);
    if (qty > maxReturn)
      throw new BadRequestException(
        `Return qty exceeds remaining (${maxReturn})`,
      );

    await this.itemModel.updateOne(
      { _id: alloc.itemId },
      {
        $inc: {
          stockAvailableQuantity: qty,
          stockIssueQuantity: -qty,
        },
      },
    );

    alloc.returnedQty = Number(alloc.returnedQty || 0) + qty;

    const line: any = issue.lines?.[0];
    if (line) {
      line.returnQty = Number(line.returnQty || 0) + qty;

      const fullyReturned =
        Number(line.returnQty || 0) >= Number(line.issuedQty || 0);

      if (fullyReturned) {
        // issue.status = 'CLOSED';
        (issue as any).closedAt = new Date();
      }
    }

    issue.markModified('lines');
    issue.markModified('allocations');
    await issue.save();

    // ✅ Track RETURN (good return)
    if (returnedBy) {
      await this.track({
        type: 'RETURN',
        qty: +qty,
        operatedBy: returnedBy,
        issue,
        itemId: alloc.itemId,
        note: `ReturnAgainstAllocation qty=${qty} allocationId=${allocationId}`,
      });

      // ✅ Track CLOSED if changed
      // await this.trackCloseIfChanged(prevStatus, issue, returnedBy);
    }

    return true;
  }

  async findIssuesByLineItemId(itemId: string) {
    // Prepare the query to handle different storage formats of itemId
    const or: any[] = [
      { 'lines.itemId': itemId }, // if stored as string
      { 'lines.itemId.$oid': itemId }, // if stored as { $oid: "..." }
    ];

    // If itemId is a valid ObjectId, we also check for ObjectId storage
    if (Types.ObjectId.isValid(itemId)) {
      or.unshift({ 'lines.itemId': new Types.ObjectId(itemId) }); // if stored as ObjectId
    }

    // Fetch issues from the database
    const issues = await this.issueModel.find({ $or: or }).lean();

    // Filter lines to match the itemId in the lines array
    const filteredIssues = issues.map((issue) => {
      // Filter lines that match the itemId
      const filteredLines = issue.lines.filter((line) => {
        const lineItemId = line.itemId?.toString(); // Convert ObjectId to string if necessary
        return lineItemId === itemId;
      });

      // Return the issue with only the matching lines
      return { ...issue, lines: filteredLines };
    });

    return filteredIssues;
  }

  /* ---------------- FIND PAGED ---------------- */

  async findAllIssuesPaged(dto: any) {
    const page = Math.max(1, Number(dto?.page || 1));
    const limitRaw = Number(dto?.limit || 10);
    const limit = Math.min(50, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const search = String(dto?.search || '').trim();
    const status = String(dto?.status || '')
      .trim()
      .toUpperCase();

    const filter: any = {};
    if (status && status !== 'ALL') filter.status = status;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      filter.$or = [{ issNo: re }, { reason: re }, { 'lines.itemName': re }];
    }

    const [total, rows] = await Promise.all([
      this.issueModel.countDocuments(filter),
      this.issueModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({
          issNo: 1,
          reason: 1,
          status: 1,
          createdAt: 1,
          lines: 1,
        })
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      rows: (rows || []).map((x: any) => ({ ...x, _id: String(x._id) })),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}
