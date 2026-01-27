import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreateStoreScrapDto,
  ScrapPagedQueryDto,
  UpdateStoreScrapDto,
} from './dto/create-store-scrap.dto';
import { StoreItemScrap } from './entities/store-scrap.schema';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { UserService } from 'src/features/user/user.service';
import { Rack } from '../../locations/rack/entities/rack.schema';
import { StoreNewItem } from '../store-item/entities/store-item.schema';
import {
  ItemRackQty,
  ItemRackQtyDocument,
} from '../../locations/rack/entities/item-rack-qty.schema';
import {
  StockTrack,
  StockTrackDocument,
  StockTrackType,
} from '../store-item/entities/stock-track.schema';

@Injectable()
export class StoreScrapService {
  constructor(
    @InjectModel(StoreItemScrap.name, 'store')
    private readonly model: Model<StoreItemScrap>,

    @InjectModel(Rack.name, 'store')
    private readonly rackModel: Model<Rack>,

    @InjectModel(StoreNewItem.name, 'store')
    private readonly itemModel: Model<StoreNewItem>,

    @InjectModel(ItemRackQty.name, 'store')
    private readonly itemRackQtyModel: Model<ItemRackQtyDocument>,

    @InjectModel(StockTrack.name, 'store')
    private readonly trackModel: Model<StockTrackDocument>,

    private readonly userService: UserService,
  ) {}

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
  private sortObj(sort?: string): Record<string, SortOrder> {
    const s = (sort || '-createdAt').trim();
    const desc = s.startsWith('-');
    const field = (desc ? s.slice(1) : s) || 'createdAt';
    return { [field]: (desc ? -1 : 1) as SortOrder } as Record<
      string,
      SortOrder
    >;
  }

  private mustOperatorId(id?: string | null, label = 'operatedBy') {
    const op = this.oidOrNull(id);
    if (!op) throw new BadRequestException(`${label} missing/invalid`);
    return op;
  }
  // create(createStoreScrapDto: CreateStoreScrapDto) {
  //   return 'This action adds a new storeScrap';
  // }

  async create(dto: CreateStoreScrapDto) {
    const itemId = String(dto.itemId || '').trim();
    const qty = Number(dto.itemQuantity || 0);
    const createdBy = String(dto.createdBy || '').trim();
    const rackId = String(dto.rackId || '').trim();

    if (!itemId) throw new BadRequestException('itemId required');
    if (!createdBy) throw new BadRequestException('receivedBy required');
    if (!rackId) throw new BadRequestException('rackId required');
    if (!Number.isFinite(qty) || qty <= 0)
      throw new BadRequestException('qty must be > 0');

    const operatedBy = this.mustOperatorId(createdBy, 'createdBy');

    // const session = await
    try {
      // await session.withTransaction(async () => {
      const item = await this.itemModel.findById(this.oid(itemId));
      // .session(session);
      if (!item) throw new BadRequestException('Item not found');

      const rack = await this.rackModel.findById(this.oid(rackId));
      // .session(session);
      if (!rack) throw new BadRequestException('rack not found');

      const user = await this.userService.findById(createdBy);
      // .session(session);
      if (!user) throw new BadRequestException('createdBy not found');

      // 1) update stock
      await this.itemModel.updateOne(
        { _id: item._id },
        {
          $inc: {
            totalStockQuantity: qty,
            stockAvailableQuantity: qty,
          },
        },
        // { session },
      );
      const createdByName = String(user.name || '').trim();
      const now = new Date();
      const updatedDate = new Date(now.getTime() + 330 * 60 * 1000);
      // 2) create receipt
      const receipt = await this.model.create(
        [
          {
            createdBy,
            createdByName,
            remark: dto.remark ?? '',
            itemId,
            itemName: item.itemName,
            itemCode: item.itemCode,
            rackId,
            rackCode: rack.code,
            roomId: rack.roomId,
            roomCode: rack.roomName,
            itemQuantity: qty,
            createdAt: updatedDate,
          },
        ],
        // { session },
      );

      const receivingDoc = receipt?.[0];

      var checkrack = await this.itemRackQtyModel.findOne({
        rackId: rackId,
        itemId: itemId,
      });
      if (!checkrack) {
        const rack = await this.rackModel.findOneAndUpdate(
          {
            _id: this.oid(rackId),
            $or: [
              {
                // isOccupied: false,
                isActive: false,
              },
              { itemId: null },
              { itemId: { $exists: false } },
              { itemId: { $type: 'string' } }, // matches old "" safely
            ],
          },
          {
            // $set: {
            // isOccupied: true,
            $push: { itemId: itemId },
            // itemName: itemName,
            // },
          },
          { new: true },
        );

        var spnew = await this.itemRackQtyModel.create({
          itemId: itemId,
          itemName: item.itemName,
          rackId: rackId,
          rackCode: rack?.code,
        });

        await this.itemRackQtyModel.findByIdAndUpdate(spnew?._id, {
          $inc: {
            totalStockQuantity: qty,
            stockAvailableQuantity: qty,
          },
        });
      } else {
        await this.itemRackQtyModel.findByIdAndUpdate(checkrack?._id, {
          $inc: {
            totalStockQuantity: qty,
            stockAvailableQuantity: qty,
          },
        });
      }

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

  findAll() {
    return `This action returns all storeScrap`;
  }

  async findAllScrapPaged(q: ScrapPagedQueryDto) {
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(200, Math.max(1, Number(q.limit || 12)));
    const skip = (page - 1) * limit;

    const filter: FilterQuery<StoreItemScrap> = {};

    const search = (q.search || '').trim();

    var datatotal = await this.model.find();

    var data = await this.model
      .find()
      .sort(this.sortObj(q.sort))
      .skip(skip)
      .limit(limit)
      .lean();

    return { rows: data, datatotal, page, limit };
  }

  findOne(id: number) {
    return `This action returns a #${id} storeScrap`;
  }

  update(id: number, updateStoreScrapDto: UpdateStoreScrapDto) {
    return `This action updates a #${id} storeScrap`;
  }

  remove(id: number) {
    return `This action removes a #${id} storeScrap`;
  }
}
