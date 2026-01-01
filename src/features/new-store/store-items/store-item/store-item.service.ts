// ✅ Stock Stock Track (renamed from StockMovement)

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { StoreNewItem } from './entities/store-item.schema';
import {
  ClientSession,
  Connection,
  FilterQuery,
  Model,
  SortOrder,
  Types,
} from 'mongoose';
import { StoreItemName } from '../store-item-name/entities/store-item-name.schema';
import { StoreCategory } from '../store-category/entities/store-category.schema';
import { Rack } from '../../locations/rack/entities/rack.schema';
import { StoreReceive } from './entities/store-receive.schema';
import {
  StockTrack,
  StockTrackDocument,
  StockTrackType,
} from './entities/stock-track.schema';
import {
  CreateItemDto,
  ItemPagedQueryDto,
  UpdateItemDto,
} from './dto/store-item.dto';
import { v4 as uuid } from 'uuid';
import { UserService } from 'src/features/user/user.service';
import { minioClient } from 'src/config/minio.config';
import { CounterService } from '../../common/code-gen.service';
import {
  ItemRackQty,
  ItemRackQtyDocument,
} from '../../locations/rack/entities/item-rack-qty.schema';

@Injectable()
export class StoreNewItemService {
  private readonly bucketName = process.env.MINIO_BUCKET || 'auth';
  constructor(
    @InjectModel(StoreNewItem.name, 'store')
    private readonly model: Model<StoreNewItem>,

    @InjectModel(StoreItemName.name, 'store')
    private readonly itemNameModel: Model<StoreItemName>,

    @InjectModel(StoreCategory.name, 'store')
    private readonly catModel: Model<StoreCategory>,

    @InjectModel(Rack.name, 'store')
    private readonly rackModel: Model<Rack>,

    @InjectModel(StoreReceive.name, 'store')
    private readonly receiveModel: Model<StoreReceive>,

    // ✅ Track Model
    @InjectModel(StockTrack.name, 'store')
    private readonly trackModel: Model<StockTrackDocument>,

    @InjectModel(ItemRackQty.name, 'store')
    private readonly itemRackQtyModel: Model<ItemRackQtyDocument>,

    // ✅ Transaction connection
    @InjectConnection('store')
    private readonly conn: Connection,

    private readonly userService: UserService,

    private readonly seq: CounterService,
  ) {}

  /* -------------------- helpers -------------------- */

  private sortObj(sort?: string): Record<string, SortOrder> {
    const s = (sort || '-createdAt').trim();
    const desc = s.startsWith('-');
    const field = (desc ? s.slice(1) : s) || 'createdAt';
    return { [field]: (desc ? -1 : 1) as SortOrder } as Record<
      string,
      SortOrder
    >;
  }

  private oid(id: string) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ObjectId: ${id}`);
    }
    return new Types.ObjectId(id);
  }

  private oidOrNull(id?: string | null) {
    const v = String(id ?? '').trim();
    return v && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
  }

  private mustOperatorId(id?: string | null, label = 'operatedBy') {
    const op = this.oidOrNull(id);
    if (!op) throw new BadRequestException(`${label} missing/invalid`);
    return op;
  }

  private async buildCategoryLabel(
    categoryId?: string | null,
  ): Promise<string> {
    if (!categoryId) return '';
    const node = await this.catModel.findById(categoryId).lean();
    if (!node) return '';
    if (!node.parentId) return node.name;

    const parent = await this.catModel.findById(node.parentId).lean();
    return parent ? `${parent.name} > ${node.name}` : node.name;
  }

  private async track(
    // session: ClientSession,///////
    input: {
      type: StockTrackType;
      qty: number;
      operatedBy: string;

      itemId?: string;
      categoryId?: string;
      rackId?: string;

      receivingId?: string;
      issueId?: string;

      refNo?: string;
      note?: string;
    },
  ) {
    await this.trackModel.create(
      [
        {
          type: input.type,
          qty: Number(input.qty || 0),

          refNo: input.refNo ?? '',
          note: input.note ?? '',

          operatedBy: input.operatedBy,

          itemId: input.itemId ?? null,
          categoryId: input.categoryId ?? null,
          rackId: input.rackId ?? null,

          receivingId: input.receivingId ?? null,
          issueId: input.issueId ?? null,
        },
      ],
      // { session },
    );
  }

  private hasAnyQty(item: any) {
    return (
      (Number(item.totalStockQuantity) || 0) > 0 ||
      (Number(item.stockAvailableQuantity) || 0) > 0 ||
      (Number(item.stockIssueQuantity) || 0) > 0 ||
      (Number(item.stockissueCompleted) || 0) > 0 ||
      (Number(item.stockscrapQuantity) || 0) > 0
    );
  }
  sanitizePrefix(p: string) {
    return p
      .replace(/[^a-zA-Z0-9/_-]/g, '')
      .replace(/^\/*/, '')
      .replace(/\/*$/, '');
  }
  decodeDataUrlToBuffer(dataUrl: string) {
    const m = /^data:(image\/[a-zA-Z0-9+.\-]+);base64,/.exec(dataUrl);
    const mime = m?.[1];
    if (!mime) throw new BadRequestException('Invalid data URL');

    const raw = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const clean = raw.replace(/\s/g, '');
    const buffer = Buffer.from(clean, 'base64');

    const ext =
      mime.includes('jpeg') || mime.includes('jpg')
        ? '.jpg'
        : mime.includes('webp')
          ? '.webp'
          : '.png';

    return { buffer, mime, ext };
  }

  async uploadImageBase64(
    identity: 'item' | 'user',
    id: string,
    base64Data: string,
    prefix: string,
  ) {
    const { buffer, mime, ext } = this.decodeDataUrlToBuffer(base64Data);
    const key = `${this.sanitizePrefix(prefix)}/${id}/${uuid()}${ext}`;

    // Resolve entity first (declare vars in outer scope)
    let entity: any;
    if (identity === 'item') {
      entity = await this.model.findById(id);
      if (!entity) throw new NotFoundException('StoreItem not found');
    } else if (identity === 'user') {
      entity = await this.userService.findById(id);
      if (!entity) throw new NotFoundException('User not found');
    } else {
      throw new BadRequestException('Invalid identity');
    }

    await minioClient.putObject(this.bucketName, key, buffer, {
      'Content-Type': mime,
    });

    const imageUrl = `https://minioimg.rrispat.in/${this.bucketName}/${key}`;
    entity.imageUrl = imageUrl;
    await entity.save();

    // Return a consistent shape
    return { imageUrl, entity };
  }

  /* -------------------- CRUD -------------------- */

  async create(dto: CreateItemDto) {
    var checkItem = await this.model.find({
      itemNameId: dto.itemNameId,
      categoryId: dto.categoryId,
    });

    if (checkItem.length > 0) {
      return { status: false, msg: 'Allready Exist Item', data: checkItem[0] };
    }

    const operatedBy = this.mustOperatorId(dto.createdBy, 'createdBy');
    const itemName = await this.itemNameModel.findById(dto.itemNameId).lean();
    const rackScrap = await this.rackModel.findById(dto.scrapRackId).lean();
    var rack: any = {};
    if (dto.rackId == '') {
      rack = await this.rackModel.findById(dto.rackId).lean();
      if (!rack) throw new BadRequestException('Rack not found');
    }

    if (!itemName) throw new BadRequestException('ItemName not found');
    if (!rackScrap) throw new BadRequestException('Rack not found');
    var categorycheck =
      dto.subCategoryId == null ? dto.categoryId : dto.subCategoryId;
    const categoryLabel = await this.buildCategoryLabel(categorycheck ?? null);

    // const { code } = await this.seq.nextCode('itemname', 'IT');
    // const scrapCode = await this.seq.nextCode('itemname', 'ITS');

    var checkfalse = await this.model.find({ isScrap: false });
    const formatfalse = this.seq.format('IT', checkfalse.length + 1);

    var checktrue = await this.model.find({ isScrap: true });
    const formattrue = this.seq.format('ITS', checktrue.length + 1);
    // const session = await
    try {
      let createdObj: any;

      // await session.withTransaction(async () => {
      const created = await this.model.create(
        [
          {
            itemNameId: this.oid(dto.itemNameId),
            itemName: itemName.name,
            itemNameCode: itemName.code,
            itemCode: formatfalse,

            rackId: [],

            categoryId: categorycheck ? this.oid(categorycheck) : null,
            categoryLabel,

            unit: dto.unit ?? '',
            description: dto.description ?? '',

            totalStockQuantity: 0,
            stockAvailableQuantity: 0,
            stockIssueQuantity: 0,
            stockissueCompleted: 0,
            stockscrapQuantity: 0,

            imageUrl: dto.imageUrl ?? '',
            createdBy: dto.createdBy ?? '',
          },
        ],
        // { session },
      );

      const createdDoc = created?.[0];
      if (!createdDoc) throw new BadRequestException('Create failed');
      if (dto.rackId != '') {
        await this.model.findByIdAndUpdate(created?.[0]._id, {
          $push: {
            rackId: dto.rackId,
          },
        });
        await this.occupyRackIfFree(
          dto.rackId,
          String(createdDoc._id),
          String(createdDoc.itemName),
        );
      }
      // ✅ occupy rack (must remain consistent with item creation)

      // ✅ track: CREATE (qty=0)
      await this.track({
        type: 'CREATE',
        qty: 0,
        operatedBy: String(operatedBy),
        itemId: String(createdDoc._id),
        categoryId: String(createdDoc.categoryId) ?? '',
        rackId: String(createdDoc.rackId) ?? '',
        refNo: String(createdDoc.itemNameCode ?? ''),
        note: `Item created: ${String(createdDoc.itemName ?? '')} (${String(
          createdDoc.itemNameCode ?? '',
        )})`,
      });

      const createdScrap = await this.model.create(
        [
          {
            itemNameId: this.oid(dto.itemNameId),
            itemName: itemName.name,
            itemNameCode: itemName.code,
            itemCode: formattrue,
            isScrap: true,

            rackId: [],

            categoryId: categorycheck ? this.oid(categorycheck) : null,
            categoryLabel,

            unit: dto.unit ?? '',
            description: dto.description ?? '',

            totalStockQuantity: 0,
            stockAvailableQuantity: 0,
            stockIssueQuantity: 0,
            stockissueCompleted: 0,
            stockscrapQuantity: 0,

            imageUrl: dto.imageUrl ?? '',
            createdBy: dto.createdBy ?? '',
          },
        ],
        // { session },
      );

      const createdDocScrap = createdScrap?.[0];
      if (!createdDocScrap) throw new BadRequestException('Create failed');

      if (dto.rackId != '') {
        await this.model.findByIdAndUpdate(createdScrap?.[0]._id, {
          $push: {
            rackId: dto.scrapRackId,
          },
        });
        await this.occupyRackIfFree(
          dto.scrapRackId,
          String(createdDocScrap._id),
          String(createdDocScrap.itemName),
        );
      }

      // ✅ occupy rack (must remain consistent with item creation)

      // ✅ track: CREATE (qty=0)
      await this.track({
        type: 'CREATE',
        qty: 0,
        operatedBy: String(operatedBy),
        itemId: String(createdDocScrap._id),
        categoryId: String(createdDocScrap.categoryId) ?? '',
        rackId: String(createdDocScrap.rackId) ?? '',
        refNo: String(createdDocScrap.itemNameCode ?? ''),
        note: `Item created: ${String(createdDocScrap.itemName ?? '')} (${String(
          createdDocScrap.itemNameCode ?? '',
        )})`,
      });

      createdObj = createdDoc.toObject();
      // });

      return { status: true, msg: 'Created', data: createdObj };
    } catch (e) {
      throw e;
    } finally {
      // await session.endSession();
    }
  }

  async update(dto: UpdateItemDto) {
    const operatedBy = this.mustOperatorId(dto.createdBy, 'updatedBy');

    // const session = await
    try {
      let updated: any;

      // await session.withTransaction(async () => {
      const patch: any = {};

      if (dto.itemNameId != null) {
        const itemName = await this.itemNameModel
          .findById(dto.itemNameId)
          .lean();
        if (!itemName) throw new BadRequestException('ItemName not found');
        patch.itemNameId = this.oid(dto.itemNameId);
        patch.itemName = itemName.name;
        patch.itemNameCode = itemName.code;
      }

      if (dto.rackId != null) {
        const rack = await this.rackModel.findById(dto.rackId).lean();
        if (!rack) throw new BadRequestException('Rack not found');
        patch.rackId.push(this.oid(dto.rackId));
      }

      if (dto.categoryId !== undefined) {
        patch.categoryId = dto.categoryId ? this.oid(dto.categoryId) : null;
        patch.categoryLabel = await this.buildCategoryLabel(
          dto.categoryId ?? null,
        );
      }

      if (dto.unit != null) patch.unit = dto.unit;
      if (dto.description != null) patch.description = dto.description;
      if (dto.imageUrl != null) patch.imageUrl = dto.imageUrl;

      const prev = await this.model.findById(this.oid(dto.id));
      // .session(session);
      if (!prev) throw new BadRequestException('Item not found');

      // ✅ if rack change: occupy new rack then update then release old rack
      // const fromRackId = prev.rackId ? String(prev.rackId) : null;
      // const toRackId = dto.rackId ? String(dto.rackId) : null;

      if (dto.rackId != null) {
        await this.occupyRackIfFree(
          dto.rackId,
          String(prev._id),
          String(prev.itemName),
        );
      }

      updated = await this.model
        .findByIdAndUpdate(dto.id, { $set: patch }, { new: true })
        .lean();

      if (!updated) throw new BadRequestException('Update failed');

      // if (toRackId && fromRackId && fromRackId !== toRackId) {
      // const released = await this.releaseRackForItem(
      //   dto.rackId,
      //   String(prev._id),
      //   // session,
      // );
      // if (!released) {
      //   throw new BadRequestException(
      //     'Old rack release failed (data mismatch)',
      //   );
      // }
      // }

      // ✅ track: EDIT (qty=0)
      await this.track({
        type: 'EDIT',
        qty: 0,
        operatedBy: String(operatedBy),
        itemId: String(updated._id),
        categoryId: updated.categoryId ? String(updated.categoryId) : '',
        rackId: updated.rackId ? String(updated.rackId) : '',
        refNo: String(updated.itemNameCode ?? ''),
        note: `Item updated: ${String(updated.itemName ?? '')} (${String(
          updated.itemNameCode ?? '',
        )})`,
      });
      // });

      return updated;
    } finally {
      // await session.endSession();
    }
  }

  async delete(id: string, deletedBy?: string) {
    // const session = await
    try {
      let ok = false;

      // await session.withTransaction(async () => {
      const item = await this.model.findById(this.oid(id));
      if (!item) throw new BadRequestException('Item not found');

      if (this.hasAnyQty(item)) {
        throw new BadRequestException(
          'Cannot delete item: quantity is not zero',
        );
      }

      const operatedBy =
        this.oidOrNull(deletedBy) ??
        this.oidOrNull(String((item as any).createdBy ?? ''));

      if (!operatedBy) {
        // Keep compatibility: allow delete, but you SHOULD pass deletedBy for full audit.
        // If you want strict mode, replace with throw.
      }

      const rackId = item.rackId ? String(item.rackId) : null;

      await this.model.deleteOne({ _id: item._id });
      // .session(session);

      if (rackId) {
        await this.releaseRackForItem(rackId, String(item._id));
      }

      if (operatedBy) {
        await this.track({
          type: 'CANCELLED',
          qty: 0,
          operatedBy: String(operatedBy),
          itemId: String(item._id),
          categoryId: item.categoryId ?? '',
          rackId: item.rackId[0] ?? '',
          refNo: String((item as any).itemNameCode ?? ''),
          note: `Item deleted: ${String((item as any).itemName ?? '')} (${String(
            (item as any).itemNameCode ?? '',
          )})`,
        });
      }

      ok = true;
      // });

      return ok;
    } finally {
      // await session.endSession();
    }
  }

  /* -------------------- Receive Stock (updates stock + receipt + track) -------------------- */

  async receiveItem(dto: {
    itemId: string;
    rackId: string;
    qty: number;
    receivedBy: string;
    remark?: string;
  }) {
    const itemId = String(dto.itemId || '').trim();
    const qty = Number(dto.qty || 0);
    const receivedBy = String(dto.receivedBy || '').trim();
    const rackId = String(dto.rackId || '').trim();

    if (!itemId) throw new BadRequestException('itemId required');
    if (!receivedBy) throw new BadRequestException('receivedBy required');
    if (!rackId) throw new BadRequestException('rackId required');
    if (!Number.isFinite(qty) || qty <= 0)
      throw new BadRequestException('qty must be > 0');

    const operatedBy = this.mustOperatorId(receivedBy, 'receivedBy');

    // const session = await
    try {
      // await session.withTransaction(async () => {
      const item = await this.model.findById(this.oid(itemId));
      // .session(session);
      if (!item) throw new BadRequestException('Item not found');

      const rack = await this.model.findById(this.oid(rackId));
      // .session(session);
      if (!rack) throw new BadRequestException('Item not found');

      // 1) update stock
      await this.model.updateOne(
        { _id: item._id },
        {
          $inc: {
            totalStockQuantity: qty,
            stockAvailableQuantity: qty,
          },
        },
        // { session },
      );

      // 2) create receipt
      const receipt = await this.receiveModel.create(
        [
          {
            receivedBy,
            remark: dto.remark ?? '',
            lines: [
              {
                itemId: item._id,
                rackId: rack._id,
                qty,
              },
            ],
          },
        ],
        // { session },
      );

      const receivingDoc = receipt?.[0];

      var checkrack = await this.itemRackQtyModel.findOne({
        rackId: rackId,
        itemId: itemId,
      });
      await this.itemRackQtyModel.findByIdAndUpdate(checkrack?._id, {
        $inc: {
          totalStockQuantity: qty,
          stockAvailableQuantity: qty,
        },
      });
      // 3) track RECEIVE (+qty)
      await this.track({
        type: 'RECEIVE',
        qty: +qty,
        operatedBy: String(operatedBy),
        itemId: String(item._id),
        categoryId: item.categoryId ?? '',
        rackId: item.rackId[0] ?? '',
        receivingId: String(receivingDoc?._id) ?? '',
        refNo: receivingDoc ? String(receivingDoc._id) : '',
        note: `Receive: +${qty}`,
      });
      // });

      return true;
    } finally {
      // await session.endSession();
    }
  }

  /* -------------------- Reads -------------------- */

  async findAllPaged(q: ItemPagedQueryDto) {
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(200, Math.max(1, Number(q.limit || 12)));
    const skip = (page - 1) * limit;

    const filter: FilterQuery<StoreNewItem> = {};
    if (q.rackId) filter.rackId = this.oid(q.rackId);
    if (q.categoryId) filter.categoryId = this.oid(q.categoryId);

    const search = (q.search || '').trim();
    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { itemNameCode: { $regex: search, $options: 'i' } },
        { rackName: { $regex: search, $options: 'i' } },
        { categoryLabel: { $regex: search, $options: 'i' } },
        { unit: { $regex: search, $options: 'i' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.model
        .find(filter)
        .sort(this.sortObj(q.sort))
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);

    return { rows, total, page, limit };
  }

  async findOne(id: string) {
    return this.model.findById(id).lean();
  }

  /* -------------------- Rack Occupancy + Transfers -------------------- */

  async transferItemToRack(
    itemId: string,
    toRackId: string,
    operatedBy?: string,
  ) {
    const item = await this.model.findById(this.oid(itemId)).lean();
    if (!item) throw new BadRequestException('Item not found');

    const fromRackId = item.rackId ? String(item.rackId) : null;
    if (!fromRackId)
      throw new BadRequestException('Item has no rack to transfer from');

    const fromRack = await this.rackModel
      .findOne({
        _id: this.oid(fromRackId),
        isOccupied: true,
        itemId: this.oid(itemId),
      })
      .lean();

    if (!fromRack)
      throw new BadRequestException(
        'Current rack is not occupied by this item',
      );

    return this.changeItemRack(itemId, toRackId, operatedBy);
  }

  async transferRack(itemId: string, toRackId: string, operatedBy?: string) {
    const item = await this.model.findById(this.oid(itemId)).lean();
    if (!item) throw new BadRequestException('Item not found');

    if (this.hasAnyQty(item)) {
      throw new BadRequestException(
        'Rack transfer allowed only when item quantity is 0',
      );
    }

    return this.changeItemRack(itemId, toRackId, operatedBy);
  }

  /// ✅ Transfer item qty between rack-mapped item docs (adjusts both docs)
  async transferItemQty(
    itemId: string,
    fromRackId: string,
    toRackId: string,
    qty: number,
    operatedBy?: string,
  ) {
    const op = this.oidOrNull(operatedBy); // optional, but recommended
    // const session = await

    try {
      // await session.withTransaction(async () => {
      const item = await this.model.findById(this.oid(itemId));
      // .session(session);
      if (!item) throw new BadRequestException('Item not found');

      const realFromRackId = item.rackId ? String(item.rackId) : null;
      if (!realFromRackId) throw new BadRequestException('Item has no rack');
      if (String(fromRackId) !== realFromRackId) {
        throw new BadRequestException('fromRackId mismatch');
      }
      if (realFromRackId === toRackId) return;

      const available = Number(item.stockAvailableQuantity) || 0;
      if (qty <= 0 || qty > available) {
        throw new BadRequestException(`Invalid qty. Must be 1..${available}`);
      }

      // destination item record: same itemNameId + toRackId
      const dest = await this.model.findOne({
        itemNameId: item.itemNameId,
        rackId: this.oid(toRackId),
      });
      // .session(session);

      if (!dest) {
        throw new BadRequestException(
          'Destination rack is not mapped to the same item',
        );
      }

      // ensure rack occupancy for destination mapping
      await this.occupyRackIfFreeOrOwned(toRackId, String(dest._id));

      // 1) decrement source (guarded)
      const dec = await this.model.updateOne(
        { _id: item._id, stockAvailableQuantity: { $gte: qty } },
        {
          $inc: {
            stockAvailableQuantity: -qty,
            totalStockQuantity: -qty,
          },
        },
        // { session },
      );

      var checkrack = await this.itemRackQtyModel.find({
        rackId: fromRackId,
        itemId: item._id,
        stockAvailableQuantity: { $gte: qty },
      });

      if (checkrack.length > 0) {
        const dec = await this.itemRackQtyModel.findByIdAndUpdate(
          checkrack![0]._id,
          {
            $inc: {
              stockAvailableQuantity: -qty,
              totalStockQuantity: -qty,
            },
          },
          // { session },
        );
      }

      if (dec.modifiedCount <= 0) {
        throw new BadRequestException('Not enough available quantity');
      }

      // 2) increment destination
      const inc = await this.model.updateOne(
        { _id: dest._id },
        {
          $inc: {
            stockAvailableQuantity: qty,
            totalStockQuantity: qty,
          },
        },
        // { session },
      );
      var checkrack = await this.itemRackQtyModel.find({
        rackId: toRackId,
        itemId: item._id,
      });

      if (checkrack.length > 0) {
        const dec = await this.itemRackQtyModel.findByIdAndUpdate(
          checkrack![0]._id,
          {
            $inc: {
              stockAvailableQuantity: qty,
              totalStockQuantity: qty,
            },
          },
          // { session },
        );
      }
      if (inc.modifiedCount <= 0) {
        // rollback
        await this.model.updateOne(
          { _id: item._id },
          { $inc: { stockAvailableQuantity: qty, totalStockQuantity: qty } },
          // { session },
        );
        throw new BadRequestException('Destination update failed');
      }

      // ✅ track: ADJUST source (-qty) and destination (+qty)
      // (only if operatedBy is provided; otherwise keep compatibility)
      if (op) {
        await this.track({
          type: 'ADJUST',
          qty: -qty,
          operatedBy: String(op),
          itemId: String(item._id),
          categoryId: item.categoryId ?? '',
          rackId: item.rackId[0] ?? '',
          refNo: String(item.itemNameCode ?? ''),
          note: `Transfer out: -${qty} to rack ${toRackId}`,
        });

        await this.track({
          type: 'ADJUST',
          qty: +qty,
          operatedBy: String(op),
          itemId: String(dest._id),
          categoryId: dest.categoryId ?? '',
          rackId: dest.rackId[0] ?? null,
          refNo: String(dest.itemNameCode ?? ''),
          note: `Transfer in: +${qty} from rack ${fromRackId}`,
        });
      }
      // });

      return true;
    } finally {
      // await session.endSession();
    }
  }

  async getSameItemRacks(itemId: string) {
    const item = await this.model.findById(this.oid(itemId)).lean();
    if (!item) throw new BadRequestException('Item not found');

    // const others = await this.model
    //   .find({
    //     itemNameId: item.itemNameId,
    //     isScrap: item.isScrap,
    //     categoryId: item.categoryId,
    //     _id: { $ne: this.oid(itemId) },
    //   })
    //   .select({ rackId: 1 })
    //   .lean();

    // console.log(others);
    // const rackIds = others
    //   .map((x: any) => String(x.rackId || ''))
    //   .filter((id) => Types.ObjectId.isValid(id))
    //   .map((id) => new Types.ObjectId(id));

    // if (rackIds.length === 0) return [];

    const racks = await this.rackModel.find({ itemId: itemId }).lean();
    return racks;
  }

  async getSameItemByRacks(itemId: string, rackId: string) {
    const item = await this.model.findById(this.oid(itemId)).lean();
    if (!item) throw new BadRequestException('Item not found');

    // const others = await this.model
    //   .find({
    //     itemNameId: item.itemNameId,
    //     isScrap: item.isScrap,
    //     categoryId: item.categoryId,
    //     _id: { $ne: this.oid(itemId) },
    //   })
    //   .select({ rackId: 1 })
    //   .lean();

    // console.log(others);
    // const rackIds = others
    //   .map((x: any) => String(x.rackId || ''))
    //   .filter((id) => Types.ObjectId.isValid(id))
    //   .map((id) => new Types.ObjectId(id));

    // if (rackIds.length === 0) return [];

    const racks = await this.rackModel
      .find({ itemId: itemId, _id: { $ne: this.oid(rackId) } })
      .lean();
    return racks;
  }

  async changeItemRack(itemId: string, toRackId: string, operatedBy?: string) {
    const op = this.oidOrNull(operatedBy); // optional
    // const session = await

    try {
      // await session.withTransaction(async () => {
      const item = await this.model.findById(this.oid(itemId));
      // .session(session);
      if (!item) throw new BadRequestException('Item not found');

      const fromRackId = item.rackId ? String(item.rackId) : null;
      if (fromRackId && fromRackId === toRackId) return;

      // await this.occupyRackIfFree(toRackId, itemId, String(item.itemName));

      // await this.model.updateOne(
      //   { _id: item._id },
      //   { $set: { rackId: this.oid(toRackId) } },
      //   // { session },
      // );

      if (fromRackId) {
        const released = await this.releaseRackForItem(
          fromRackId,
          itemId,
          // session,
        );

        if (!released) {
          await this.rackModel.updateOne(
            { _id: this.oid(toRackId), itemId: this.oid(itemId) },
            { $set: { isOccupied: false, itemId: null } },
            // { session },
          );
          await this.itemRackQtyModel.findByIdAndDelete({
            rackId: fromRackId,
            itemId: itemId,
          });
          throw new BadRequestException(
            'Old rack release failed (data mismatch)',
          );
        }
      }

      // ✅ track: EDIT (qty=0)
      if (op) {
        await this.track({
          type: 'EDIT',
          qty: 0,
          operatedBy: String(op),
          itemId: String(item._id),
          categoryId: item.categoryId ?? '',
          rackId: toRackId,
          refNo: String((item as any).itemNameCode ?? ''),
          note: `Rack changed: ${String(fromRackId ?? '')} -> ${String(toRackId)}`,
        });
      }
      // });

      return true;
    } finally {
      // await session.endSession();
    }
  }

  private async occupyRackIfFree(
    rackId: string,
    itemId: string,
    itemName: string,
  ) {
    const rack = await this.rackModel.findOneAndUpdate(
      {
        _id: this.oid(rackId),
        $or: [
          { isOccupied: false },
          { itemId: null },
          { itemId: { $exists: false } },
          { itemId: { $type: 'string' } }, // matches old "" safely
        ],
      },
      {
        $set: {
          isOccupied: true,
          itemId: this.oid(itemId),
        },
      },
      { new: true },
    );

    await this.itemRackQtyModel.create({
      itemId: itemId,
      itemName: '',
      rackId: rackId,
      rackCode: '',
    });

    if (!rack) throw new BadRequestException('Rack already occupied');
    return rack;
  }

  private async occupyRackIfFreeOrOwned(rackId: string, itemId: string) {
    const item = await this.model
      .findOne({ _id: this.oid(itemId) })
      // .session(session)
      .lean();
    if (!item) throw new BadRequestException('Rack not found');

    const rack = await this.rackModel
      .findOne({ _id: this.oid(rackId) })
      // .session(session)
      .lean();
    if (!rack) throw new BadRequestException('Rack not found');

    if (rack.itemId && String(rack.itemId) === itemId) return true;

    await this.occupyRackIfFree(rackId, itemId, String(item.itemName));

    return true;
  }

  private async releaseRackForItem(rackId: string, itemId: string) {
    const res = await this.rackModel.updateOne(
      { _id: this.oid(rackId), itemId: this.oid(itemId) },
      { $set: { isOccupied: false, itemId: null } },
    );

    await this.itemRackQtyModel.findByIdAndDelete({
      rackId: rackId,
      itemId: itemId,
    });
    return res.modifiedCount > 0;
  }

  async getItemByRack(rackId: string) {
    if (!rackId) return null;

    const rack = await this.rackModel.findById(this.oid(rackId)).lean();
    if (!rack) return null;

    const itemId = rack.itemId ? String(rack.itemId) : '';
    if (!itemId) return null;

    const item = await this.model.findById(this.oid(itemId)).lean();
    return item || null;
  }

  async getItemNameRacks(itemNameId: string) {
    if (!itemNameId) return [];

    const items = await this.model
      .find({ itemNameId: this.oid(itemNameId) })
      .select({
        rackId: 1,
        rackName: 1,
        totalStockQuantity: 1,
        stockAvailableQuantity: 1,
      })
      .lean();

    const rackIds = items
      .map((x: any) => x.rackId)
      .filter(Boolean)
      .map((x: any) => this.oid(String(x)));

    const racks = await this.rackModel
      .find({ _id: { $in: rackIds } })
      .select({ name: 1, code: 1 })
      .lean();

    const rackById = new Map<string, any>(
      racks.map((r: any) => [String(r._id), r]),
    );

    return items.map((it: any) => {
      const rid = it.rackId ? String(it.rackId) : '';
      const r = rackById.get(rid);
      return {
        itemId: String(it._id),
        rackId: rid,
        rackName: r?.name ?? it.rackName ?? '',
        rackCode: r?.code ?? '',
        available: Number(it.stockAvailableQuantity || 0),
        total: Number(it.totalStockQuantity || 0),
      };
    });
  }

  async itemsubcategory(itemId: string) {
    // if (!Types.ObjectId.isValid(itemId)) {
    //   throw new BadRequestException('Invalid itemId');
    // }

    const item = await this.model.findById(itemId).lean();
    if (!item) throw new NotFoundException('Item not found');

    const baseCategoryId = item.categoryId;
    if (!baseCategoryId) {
      // no category => no subcategory items
      return [];
    }

    // Find subcategories where parentId == baseCategoryId
    const subcats = await this.catModel
      .find({ parentId: baseCategoryId }, { _id: 1 })
      .lean();

    const subcatIds = subcats.map((c) => c._id);

    // If no subcategories exist, return base item only (optional)
    if (subcatIds.length === 0) {
      return []; // or return [] based on your UI logic
    }

    // Fetch ALL items matching those subcategory ids
    const itemsList = await this.model
      .find({ categoryId: { $in: subcatIds } })
      .lean();

    return itemsList;
  }

  async itemOne(id: string) {
    return await this.model.find({ _id: id }).lean();
  }

  async findOneRack(id: string) {
    return await this.rackModel.findById(id).lean();
  }

  async scrapItem(dto: any) {
    console.log(dto);
    const itemsCheck = await this.model.findById(dto.itemId).lean();

    // Step 1: Fetch items with isScrap flag true
    const items = await this.model
      .find({
        itemNameId: itemsCheck!.itemNameId,
        categoryId: itemsCheck!.categoryId,
        isScrap: true,
      })
      .lean();

    // Step 2: Get the array of item IDs
    const itemIds = items.map((item) => item._id); // More efficient than using a loop

    // Step 3: Find racks based on the item IDs and roomId
    return await this.rackModel
      .find({
        roomId: dto.roomId, // Use roomId from dto
        itemId: { $in: itemIds }, // Filter racks with item IDs from the fetched items
      })
      .lean();
  }
}
