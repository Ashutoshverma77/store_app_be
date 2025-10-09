import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder, Types } from 'mongoose';
import { StorePlace } from './schema/store-place.schema';
import { CreateStorePlaceDto } from './dto/create-store-place.dto';
import { UpdateStorePlaceDto } from './dto/update-store-place.dto';
import { StorePlaceItemQuantity } from './schema/store-place-item-quantity.schema';
import { minioClient } from 'src/config/minio.config';

@Injectable()
export class StorePlaceService {
  private readonly bucketName = process.env.MINIO_BUCKET || 'auth';
  constructor(
    @InjectModel(StorePlace.name, 'store')
    private storePlaceSchema: Model<StorePlace>,
    @InjectModel(StorePlaceItemQuantity.name, 'store')
    private readonly spiqModel: Model<StorePlaceItemQuantity>,
  ) {}

  private toInt(v: any): number {
    if (typeof v === 'number') return v;
    const n = parseInt(String(v ?? '0'), 10);
    return Number.isFinite(n) ? n : 0;
  }

  async create(createStorePlaceDto: CreateStorePlaceDto) {
    await this.storePlaceSchema.create(createStorePlaceDto);

    return { msg: 'Store Place Created Successfully.....', status: true };
  }

  async findAll() {
    return await this.storePlaceSchema.find();
  }

  parseSortToArray(sort?: string): [string, SortOrder][] {
    if (!sort || typeof sort !== 'string') return [['createdAt', -1]];
    const field = sort.replace(/^-/, '') || 'createdAt';
    const dir: SortOrder = sort.startsWith('-') ? -1 : 1;
    return [[field, dir]];
  }

  async findPaged(opts: {
    page: number;
    limit: number;
    search?: string;
    sort?: string;
  }) {
    const page = Math.max(1, +opts.page || 1);
    const limit = Math.min(200, Math.max(1, +opts.limit || 12));
    const skip = (page - 1) * limit;

    const q: any = {};
    const s = (opts.search ?? '').trim();
    if (s) {
      q.$or = [
        { name: { $regex: s, $options: 'i' } },
        { code: { $regex: s, $options: 'i' } },
        { type: { $regex: s, $options: 'i' } },
      ];
    }

    const sortArr = this.parseSortToArray(opts.sort); // <-- typed as [string, SortOrder][]

    const [rows, total] = await Promise.all([
      this.storePlaceSchema
        .find(q)
        .sort(sortArr)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.storePlaceSchema.countDocuments(q),
    ]);

    return { rows, total, page, limit };
  }

  async findAllPlaceQuantity() {
    return await this.spiqModel.find();
  }

  async findOne(id: string) {
    return await this.storePlaceSchema.findById(id);
  }

  async listPlaceItems(opts: {
    placeId: string;
    itemId?: string;
    search?: string;
    limit?: number;
    skip?: number;
  }) {
    if (!Types.ObjectId.isValid(opts.placeId)) return [];

    const match: any = {
      // SPIQ stores hex strings for ids
      placeId: new Types.ObjectId(opts.placeId).toHexString(),
    };
    if (opts.itemId && Types.ObjectId.isValid(opts.itemId)) {
      match.itemId = new Types.ObjectId(opts.itemId).toHexString();
    }

    const pipeline: any[] = [
      { $match: match },

      // Convert hex strings to ObjectId for $lookup
      {
        $addFields: {
          itemObjId: {
            $cond: [
              { $eq: [{ $type: '$itemId' }, 'objectId'] },
              '$itemId',
              { $toObjectId: '$itemId' },
            ],
          },
          placeObjId: {
            $cond: [
              { $eq: [{ $type: '$placeId' }, 'objectId'] },
              '$placeId',
              { $toObjectId: '$placeId' },
            ],
          },
        },
      },

      // Join item & place (projection-only pipeline is OK)
      {
        $lookup: {
          from: 'storeitems',
          localField: 'itemObjId',
          foreignField: '_id',
          as: '_item',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'storeplaces',
          localField: 'placeObjId',
          foreignField: '_id',
          as: '_place',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: '$_item', preserveNullAndEmptyArrays: true } }, // <-- prefix with $
      { $unwind: { path: '$_place', preserveNullAndEmptyArrays: true } }, // <-- prefix with $

      // Normalize numeric SPIQ string fields
      {
        $addFields: {
          totalNum: { $toInt: { $ifNull: ['$totalQuantity', '0'] } },
          issuedNum: { $toInt: { $ifNull: ['$IssuedQuantity', '0'] } },
          completedNum: { $toInt: { $ifNull: ['$completedQuantity', '0'] } },
        },
      },

      // Optional search by item name (stored or joined)
      ...(opts.search && opts.search.trim()
        ? [
            {
              $match: {
                $or: [
                  { itemName: { $regex: opts.search.trim(), $options: 'i' } },
                  {
                    '_item.name': { $regex: opts.search.trim(), $options: 'i' },
                  },
                ],
              },
            },
          ]
        : []),

      {
        $project: {
          _id: 1,
          itemId: 1, // keep original hex
          placeId: 1, // keep original hex
          itemName: { $ifNull: ['$itemName', '$_item.name'] },
          placeName: { $ifNull: ['$placeName', '$_place.name'] },
          totalQuantity: '$totalNum',
          issuedQuantity: '$issuedNum',
          completedQuantity: '$completedNum',
          available: {
            $subtract: ['$totalNum', { $add: ['$issuedNum', '$completedNum'] }],
          },
          remark: { $ifNull: ['$remark', ''] },
          createdAt: 1,
          updatedAt: 1,
        },
      },

      ...(opts.skip ? [{ $skip: Number(opts.skip) }] : []),
      ...(opts.limit ? [{ $limit: Number(opts.limit) }] : []),
    ];

    return this.spiqModel.aggregate(pipeline).exec();
  }

  async update(id: string, updateStorePlaceDto: UpdateStorePlaceDto) {
    var check = await this.storePlaceSchema.findById(id);
    if (!check) {
      return { msg: 'Store Place Update Failed', status: false };
    }

    await this.storePlaceSchema.findByIdAndUpdate(id, updateStorePlaceDto);
    return { msg: 'Store Place Updated Successfully.....', status: true };
  }

  async remove(id: string) {
    var check = await this.storePlaceSchema.findById(id);
    if (!check) {
      return { msg: 'Store Place Delete Failed', status: false };
    }
    await this.storePlaceSchema.findByIdAndDelete(id);
    return { msg: 'Store Place Deleted Successfully.....', status: true };
  }
}
function uuid() {
  throw new Error('Function not implemented.');
}
