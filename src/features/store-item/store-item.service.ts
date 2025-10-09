import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateStoreItemDto } from './dto/create-store-item.dto';
import { UpdateStoreItemDto } from './dto/update-store-item.dto';
import { InjectModel } from '@nestjs/mongoose';
import { StoreItem } from './schema/store-item.schema';
import {
  FilterQuery,
  isValidObjectId,
  Model,
  SortOrder,
  Types,
} from 'mongoose';
import { v4 as uuid } from 'uuid';
import { StockMovement } from '../item-receive/schema/stock-movement.schema';
import { StorePlace } from '../store-place/schema/store-place.schema';
import { StorePlaceItemQuantity } from '../store-place/schema/store-place-item-quantity.schema';
import { minioClient } from 'src/config/minio.config';
import { UserService } from '../user/user.service';

type ListScrapParams = {
  itemId?: string;
  placeId?: string;
  dateFrom?: string; // ISO or yyyy-mm-dd
  dateTo?: string; // ISO or yyyy-mm-dd
  limit?: number;
  skip?: number;
  search?: string; // optional fuzzy search on item/place name
};

export interface FindPagedOpts {
  page?: number; // 1-based
  limit?: number; // 1..200
  search?: string; // name/code/category contains
  sort?: string; // "-createdAt", "name", "-totalStockQuantity", etc.
}

@Injectable()
export class StoreItemService {
  private readonly bucketName = process.env.MINIO_BUCKET || 'auth';

  constructor(
    @InjectModel(StoreItem.name, 'store')
    private storeItemSchema: Model<StoreItem>,

    @InjectModel(StorePlace.name, 'store')
    private readonly placeModel: Model<StorePlace>,

    @InjectModel(StorePlaceItemQuantity.name, 'store')
    private readonly spiqModel: Model<StorePlaceItemQuantity>,

    @InjectModel(StockMovement.name, 'store')
    private readonly movModel: Model<StockMovement>,

    private readonly userService: UserService,
  ) {}

  private toInt(s: any): number {
    const n = parseInt(String(s ?? '0'), 10);
    return Number.isFinite(n) ? n : 0;
  }
  private toStr(n: number): string {
    return String(n);
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
      entity = await this.storeItemSchema.findById(id);
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

  sanitizePrefix(p: string) {
    return p
      .replace(/[^a-zA-Z0-9/_-]/g, '')
      .replace(/^\/*/, '')
      .replace(/\/*$/, '');
  }

  async create(createStoreItemDto: CreateStoreItemDto) {
    var data = await this.storeItemSchema.create(createStoreItemDto);
    const id = data._id.toString(); // or just: const id = doc.id;
    return {
      msg: 'Store Item Created Successfully.....',
      status: true,
      data: { _id: id, id },
    };
  }

  // In your service class
  async scrapFromPlace(dto: any) {
    try {
      const userIdRaw = dto?.userId ? String(dto.userId).trim() : '';
      const itemIdRaw = String(dto?.itemid ?? dto?.itemId ?? '').trim();
      const placeIdRaw = String(dto?.placeId ?? '').trim();
      const qty = Number(dto?.quantity ?? dto?.qty ?? 0);

      // ---- shape & format ----
      if (
        !isValidObjectId(itemIdRaw) ||
        !isValidObjectId(placeIdRaw) ||
        !Number.isInteger(qty) ||
        qty <= 0
      ) {
        return { msg: 'Scrap Item Failed.......', status: false };
      }
      if (userIdRaw && !isValidObjectId(userIdRaw)) {
        return { msg: 'Scrap Item Failed.......', status: false };
      }

      const itemId = new Types.ObjectId(itemIdRaw);
      const placeId = new Types.ObjectId(placeIdRaw);
      const opUser = userIdRaw ? new Types.ObjectId(userIdRaw) : undefined;

      // ---- existence ----
      const [itemDoc, placeDoc] = await Promise.all([
        this.storeItemSchema.findById(itemId).lean(),
        this.placeModel.findById(placeId).lean(),
      ]);
      if (!itemDoc || !placeDoc) {
        return { msg: 'Scrap Item Failed.......', status: false };
      }

      // ---- SPIQ availability (total - issued - completed) ----
      const itemHex = itemId.toHexString();
      const placeHex = placeId.toHexString();
      const spiq = await this.spiqModel
        .findOne({ itemId: itemHex, placeId: placeHex })
        .lean();
      if (!spiq) {
        return { msg: 'Scrap Item Failed.......', status: false };
      }
      const total = this.toInt(spiq.totalQuantity);
      const issued = this.toInt(spiq.IssuedQuantity);
      const completed = this.toInt(spiq.completedQuantity);
      const placeAvail = total - issued - completed;
      if (qty > placeAvail) {
        return { msg: 'Scrap Item Failed.......', status: false };
      }

      // ---- store item guard: cannot go negative ----
      const avail = Number(itemDoc.stockAvailableQuantity ?? 0);
      // const totalItem = Number(itemDoc.totalStockQuantity ?? 0);
      if (qty > avail) {
        return { msg: 'Scrap Item Failed.......', status: false };
      }

      // ---- apply updates (wrap in session if you use transactions) ----
      try {
        // 1) Item counters
        const resItem = await this.storeItemSchema.updateOne(
          {
            _id: itemId,
            stockAvailableQuantity: { $gte: qty },
            // totalStockQuantity: { $gte: qty },
          },
          {
            $inc: {
              stockAvailableQuantity: -qty,
              // totalStockQuantity: -qty,
              stockscrapQuantity: +qty,
            },
          },
        );
        if (resItem.matchedCount !== 1 || resItem.modifiedCount !== 1) {
          throw new Error('StoreItem counters would go negative');
        }

        // 2) SPIQ totalQuantity -= qty (string)
        const spiqDoc = await this.spiqModel.findOne({
          itemId: itemHex,
          placeId: placeHex,
        });
        if (!spiqDoc) throw new Error('SPIQ not found at update time');
        const curTotal = this.toInt(spiqDoc.totalQuantity);
        if (curTotal < qty) {
          throw new Error('SPIQ total would go negative');
        }
        spiqDoc.totalQuantity = this.toStr(curTotal - qty);
        await spiqDoc.save();

        // 3) movement
        await this.movModel.create({
          itemId,
          placeId,
          type: 'SCRAP',
          qty,
          refNo: 'SCRAP',
          operatedBy: opUser ?? new Types.ObjectId(itemDoc.createdBy),
          note: 'Manual scrap from place',
        });
      } catch (e) {
        // this.logger.error(`scrapFromPlace tx failed: ${e?.message || e}`);
        return { msg: 'Scrap Item Failed.......', status: false };
      }

      return { msg: 'Scrap Completed.......', status: true };
    } catch (e) {
      // this.logger.error(`scrapFromPlace failed: ${e?.message || e}`);
      return { msg: 'Scrap Item Failed.......', status: false };
    }
  }

  async listScrap(params: ListScrapParams = {}) {
    const match: any = { type: 'SCRAP' };

    if (params.itemId && Types.ObjectId.isValid(params.itemId)) {
      match.itemId = new Types.ObjectId(params.itemId);
    }
    if (params.placeId && Types.ObjectId.isValid(params.placeId)) {
      match.placeId = new Types.ObjectId(params.placeId);
    }

    // Date filter on createdAt
    if (params.dateFrom || params.dateTo) {
      const createdAt: any = {};
      if (params.dateFrom) {
        const d = new Date(params.dateFrom);
        if (!isNaN(d.getTime())) createdAt.$gte = d;
      }
      if (params.dateTo) {
        // include whole day if only date is sent
        const d = new Date(params.dateTo);
        if (!isNaN(d.getTime())) {
          // if only date part, push to end-of-day
          if (/^\d{4}-\d{2}-\d{2}$/.test(params.dateTo)) {
            d.setHours(23, 59, 59, 999);
          }
          createdAt.$lte = d;
        }
      }
      if (Object.keys(createdAt).length) match.createdAt = createdAt;
    }

    const pipeline: any[] = [
      { $match: match },
      { $sort: { createdAt: -1 } },

      // join StoreItem
      {
        $lookup: {
          from: 'storeitems',
          localField: 'itemId',
          foreignField: '_id',
          as: '_item',
          pipeline: [{ $project: { _id: 1, name: 1, unit: 1 } }],
        },
      },
      { $unwind: { path: '$_item', preserveNullAndEmptyArrays: true } },

      // join StorePlace
      {
        $lookup: {
          from: 'storeplaces',
          localField: 'placeId',
          foreignField: '_id',
          as: '_place',
          pipeline: [{ $project: { _id: 1, name: 1 } }],
        },
      },
      { $unwind: { path: '$_place', preserveNullAndEmptyArrays: true } },

      // (optional) join Users for operatedBy
      {
        $lookup: {
          from: 'users',
          localField: 'operatedBy',
          foreignField: '_id',
          as: '_user',
          pipeline: [{ $project: { _id: 1, name: 1, email: 1 } }],
        },
      },
      { $unwind: { path: '$_user', preserveNullAndEmptyArrays: true } },

      // optional fuzzy search on item/place name
      ...(params.search && params.search.trim()
        ? [
            {
              $match: {
                $or: [
                  {
                    '_item.name': {
                      $regex: params.search.trim(),
                      $options: 'i',
                    },
                  },
                  {
                    '_place.name': {
                      $regex: params.search.trim(),
                      $options: 'i',
                    },
                  },
                  { note: { $regex: params.search.trim(), $options: 'i' } },
                ],
              },
            },
          ]
        : []),

      {
        $project: {
          _id: 1,
          type: 1,
          qty: 1,
          refNo: 1,
          note: 1,
          createdAt: 1,
          updatedAt: 1,
          itemId: 1,
          placeId: 1,
          receivingId: 1,
          issueId: 1,
          operatedBy: 1,

          // enriched fields
          itemName: { $ifNull: ['$_item.name', ''] },
          itemUnit: { $ifNull: ['$_item.unit', ''] },
          placeName: { $ifNull: ['$_place.name', ''] },
          operatedByName: { $ifNull: ['$_user.name', ''] },
          operatedByEmail: { $ifNull: ['$_user.email', ''] },
        },
      },

      ...(params.skip ? [{ $skip: Number(params.skip) }] : []),
      ...(params.limit
        ? [{ $limit: Number(params.limit) }]
        : [{ $limit: 1000 }]),
    ];

    const rows = await this.movModel.aggregate(pipeline).exec();

    // normalize for FE (stringify ObjectIds + defaults)
    return rows.map((d: any) => ({
      id: String(d._id ?? ''),
      type: String(d.type ?? ''),
      qty: Number(d.qty ?? 0),
      refNo: String(d.refNo ?? ''),
      note: String(d.note ?? ''),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,

      itemId: String(d.itemId ?? ''),
      itemName: String(d.itemName ?? ''),
      itemUnit: String(d.itemUnit ?? ''),

      placeId: String(d.placeId ?? ''),
      placeName: String(d.placeName ?? ''),

      receivingId: d.receivingId ? String(d.receivingId) : '',
      issueId: d.issueId ? String(d.issueId) : '',

      operatedBy: d.operatedBy ? String(d.operatedBy) : '',
      operatedByName: String(d.operatedByName ?? ''),
      operatedByEmail: String(d.operatedByEmail ?? ''),
    }));
  }

  async listScrapPaged(body: any) {
    const page = Math.max(1, Number(body?.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(body?.limit ?? 12)));
    const skip = (page - 1) * limit;

    const search = String(body?.search ?? '').trim(); // matches item/place/note
    const item = String(body?.item ?? '').trim(); // item only
    const place = String(body?.place ?? '').trim(); // place only
    const dateFrom = body?.dateFrom ? String(body.dateFrom) : null;
    const dateTo = body?.dateTo ? String(body.dateTo) : null;

    const sortStr = String(body?.sort ?? '-createdAt');
    const dir = sortStr.startsWith('-') ? -1 : 1;
    const field = sortStr.replace(/^-/, '') || 'createdAt';
    const sort: Record<string, 1 | -1> = { [field]: dir };

    // Build the same base pipeline as your listScrap(), then $facet for total + rows
    const match: any = { type: 'SCRAP' };

    // Date range
    if (dateFrom || dateTo) {
      const createdAt: any = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (!isNaN(d.getTime())) createdAt.$gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (!isNaN(d.getTime())) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) d.setHours(23, 59, 59, 999);
          createdAt.$lte = d;
        }
      }
      if (Object.keys(createdAt).length) match.createdAt = createdAt;
    }

    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: 'storeitems',
          localField: 'itemId',
          foreignField: '_id',
          as: '_item',
          pipeline: [{ $project: { _id: 1, name: 1, unit: 1 } }],
        },
      },
      { $unwind: { path: '$_item', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'storeplaces',
          localField: 'placeId',
          foreignField: '_id',
          as: '_place',
          pipeline: [{ $project: { _id: 1, name: 1 } }],
        },
      },
      { $unwind: { path: '$_place', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'users',
          localField: 'operatedBy',
          foreignField: '_id',
          as: '_user',
          pipeline: [{ $project: { _id: 1, name: 1, email: 1 } }],
        },
      },
      { $unwind: { path: '$_user', preserveNullAndEmptyArrays: true } },

      // Combined fuzzy search (search on item/place/note)
      ...(search && search.length
        ? [
            {
              $match: {
                $or: [
                  { '_item.name': { $regex: search, $options: 'i' } },
                  { '_place.name': { $regex: search, $options: 'i' } },
                  { note: { $regex: search, $options: 'i' } },
                ],
              },
            },
          ]
        : []),

      // Item-only fuzzy
      ...(item && item.length
        ? [{ $match: { '_item.name': { $regex: item, $options: 'i' } } }]
        : []),

      // Place-only fuzzy
      ...(place && place.length
        ? [{ $match: { '_place.name': { $regex: place, $options: 'i' } } }]
        : []),

      {
        $project: {
          _id: 1,
          type: 1,
          qty: 1,
          refNo: 1,
          note: 1,
          createdAt: 1,
          updatedAt: 1,
          itemId: 1,
          placeId: 1,
          receivingId: 1,
          issueId: 1,
          operatedBy: 1,
          itemName: { $ifNull: ['_item.name', ''] },
          itemUnit: { $ifNull: ['_item.unit', ''] },
          placeName: { $ifNull: ['_place.name', ''] },
          operatedByName: { $ifNull: ['_user.name', ''] },
          operatedByEmail: { $ifNull: ['_user.email', ''] },
        },
      },

      // Facet for total + rows (paged)
      {
        $facet: {
          total: [{ $count: 'count' }],
          rows: [
            { $sort: { [field]: dir } },
            { $skip: skip },
            { $limit: limit },
          ],
        },
      },
      {
        $project: {
          rows: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      },
    ];

    const res = await (this.movModel as any).aggregate(pipeline).exec();
    const { rows, total } = (res && res[0]) || { rows: [], total: 0 };

    // Normalize ids to string
    const out = (rows as any[]).map((d) => ({
      id: String(d._id ?? ''),
      type: String(d.type ?? ''),
      qty: Number(d.qty ?? 0),
      refNo: String(d.refNo ?? ''),
      note: String(d.note ?? ''),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      itemId: String(d.itemId ?? ''),
      itemName: String(d.itemName ?? ''),
      itemUnit: String(d.itemUnit ?? ''),
      placeId: String(d.placeId ?? ''),
      placeName: String(d.placeName ?? ''),
      receivingId: d.receivingId ? String(d.receivingId) : '',
      issueId: d.issueId ? String(d.issueId) : '',
      operatedBy: d.operatedBy ? String(d.operatedBy) : '',
      operatedByName: String(d.operatedByName ?? ''),
      operatedByEmail: String(d.operatedByEmail ?? ''),
    }));

    return { rows: out, total, page, limit };
  }

  parseSort(sort?: string): Record<string, SortOrder> {
    if (!sort || typeof sort !== 'string') return { createdAt: -1 };

    const dir: SortOrder = sort.startsWith('-') ? -1 : 1;
    const field = sort.replace(/^-/, '').trim();

    // (optional) whitelist fields to avoid typos/injection
    const allowed = new Set(['createdAt', 'name', 'code', 'category', '_id']);
    const key = allowed.has(field) ? field : 'createdAt';

    return { [key]: dir };
  }

  async findPaged(opts: FindPagedOpts) {
    const page = Math.max(1, Number(opts.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(opts.limit ?? 12)));
    const skip = (page - 1) * limit;

    // ✅ sanitize search
    const search = typeof opts.search === 'string' ? opts.search.trim() : '';

    const q: FilterQuery<StoreItem> = {};

    if (search.length > 0) {
      const or: FilterQuery<StoreItem>[] = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];

      // allow searching by ObjectId (only when valid 24-hex)
      if (Types.ObjectId.isValid(search)) {
        or.push({ _id: new Types.ObjectId(search) as any });
      }

      q.$or = or;
    }

    const sort = this.parseSort(opts.sort);

    const [rows, total] = await Promise.all([
      // Cast `sort` to satisfy Mongoose types if needed
      (this.storeItemSchema as any)
        .find(q)
        .sort(sort as any)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.storeItemSchema.countDocuments(q),
    ]);

    return { rows, total, page, limit };
  }

  async findAll() {
    return await this.storeItemSchema.find();
  }

  async findOne(id: string) {
    return await this.storeItemSchema.findById(id);
  }

  async update(id: string, updateStoreItemDto: UpdateStoreItemDto) {
    var check = await this.storeItemSchema.findById(id);
    if (!check) {
      return { msg: 'Store Item Update Failed', status: false };
    }

    var data = await this.storeItemSchema.findByIdAndUpdate(
      id,
      updateStoreItemDto,
    );
    return {
      msg: 'Store Item Updated Successfully.....',
      status: true,
    };
  }

  async remove(id: string) {
    var check = await this.storeItemSchema.findById(id);
    if (!check) {
      return { msg: 'Store Item Delete Failed', status: false };
    }
    await this.storeItemSchema.findByIdAndDelete(id);
    return { msg: 'Store Item Deleted Successfully.....', status: true };
  }
}
