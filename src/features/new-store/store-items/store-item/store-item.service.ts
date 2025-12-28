import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { StoreNewItem } from './entities/store-item.schema';
import { StoreItemName } from '../store-item-name/entities/store-item-name.schema';
import { StoreCategory } from '../store-category/entities/store-category.schema';
import { Rack } from '../../locations/rack/entities/rack.schema';
import {
  CreateItemDto,
  ItemPagedQueryDto,
  UpdateItemDto,
} from './dto/store-item.dto';

@Injectable()
export class StoreItemService {
  constructor(
    @InjectModel(StoreNewItem.name, 'store')
    private readonly model: Model<StoreNewItem>,
    @InjectModel(StoreItemName.name, 'store')
    private readonly itemNameModel: Model<StoreItemName>,
    @InjectModel(StoreCategory.name, 'store')
    private readonly catModel: Model<StoreCategory>,
    @InjectModel(Rack.name, 'store') private readonly rackModel: Model<Rack>,
  ) {}

  private sortObj(sort?: string): Record<string, SortOrder> {
    const s = (sort || '-createdAt').trim();
    const desc = s.startsWith('-');
    const field = desc ? s.slice(1) : s;
    return { [field]: desc ? -1 : 1 };
  }

  private oid(id: string) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid ObjectId: ${id}`);
    }
    return new Types.ObjectId(id);
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

  async create(dto: CreateItemDto) {
    const itemName = await this.itemNameModel.findById(dto.itemNameId).lean();
    const rack = await this.rackModel.findById(dto.rackId).lean();

    if (!itemName) throw new Error('ItemName not found');
    if (!rack) throw new Error('Rack not found');

    const categoryLabel = await this.buildCategoryLabel(dto.categoryId ?? null);

    const created = await this.model.create({
      itemNameId: this.oid(dto.itemNameId),
      itemName: itemName.name,
      itemNameCode: itemName.code,

      rackId: this.oid(dto.rackId),
      rackName: (rack as any).name ?? '',

      categoryId: dto.categoryId ? this.oid(dto.categoryId) : null,
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
    });

    try {
      await this.occupyRackIfFree(dto.rackId, String(created._id));
    } catch (e) {
      // rollback item if rack allocation failed
      await this.model.deleteOne({ _id: created._id });
      throw e;
    }

    return created.toObject();
  }

  async update(dto: UpdateItemDto) {
    const patch: any = {};

    if (dto.itemNameId != null) {
      const itemName = await this.itemNameModel.findById(dto.itemNameId).lean();
      if (!itemName) throw new Error('ItemName not found');
      patch.itemNameId = this.oid(dto.itemNameId);
      patch.itemName = itemName.name;
      patch.itemNameCode = itemName.code;
    }

    if (dto.rackId != null) {
      const rack = await this.rackModel.findById(dto.rackId).lean();
      if (!rack) throw new Error('Rack not found');
      patch.rackId = this.oid(dto.rackId);
      patch.rackName = (rack as any).name ?? '';
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

    const updated = await this.model
      .findByIdAndUpdate(dto.id, { $set: patch }, { new: true })
      .lean();
    return updated;
  }
  async delete(id: string) {
    const item = await this.model.findById(this.oid(id)).lean();
    if (!item) throw new BadRequestException('Item not found');

    // ✅ rule: only delete if all qty are 0
    if (this.hasAnyQty(item)) {
      throw new BadRequestException('Cannot delete item: quantity is not zero');
    }

    const rackId = item.rackId ? String(item.rackId) : null;

    // ✅ delete item first
    await this.model.deleteOne({ _id: this.oid(id) });

    // ✅ release rack (only if it really belonged to this item)
    if (rackId) {
      await this.releaseRackForItem(rackId, id);
      // if release fails, we ignore (data mismatch) OR you can throw
    }

    return true;
  }

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

  // async changeItemRack(itemId: string, toRackId: string) {
  //   const item = await this.model.findById(this.oid(itemId)).lean();
  //   if (!item) throw new Error('Item not found');

  //   const fromRackId = item.rackId ? String(item.rackId) : null;
  //   if (fromRackId && fromRackId === toRackId) return true;

  //   // 1) occupy new rack (must be free)
  //   await this.occupyRackIfFree(toRackId, itemId);

  //   // 2) update item -> new rack
  //   await this.model.updateOne(
  //     { _id: this.oid(itemId) },
  //     { $set: { rackId: this.oid(toRackId) } },
  //   );

  //   // 3) release old rack (only if it belonged to this item)
  //   if (fromRackId) {
  //     const released = await this.releaseRackForItem(fromRackId, itemId);
  //     if (!released) {
  //       // rollback: free the new rack if release fails
  //       await this.rackModel.updateOne(
  //         { _id: this.oid(toRackId), itemId: this.oid(itemId) },
  //         { $set: { isOccupied: false, itemId: null } },
  //       );
  //       throw new Error('Old rack release failed (data mismatch)');
  //     }
  //   }

  //   return true;
  // }

  async transferItemToRack(itemId: string, toRackId: string) {
    const item = await this.model.findById(this.oid(itemId)).lean();
    if (!item) throw new Error('Item not found');

    const fromRackId = item.rackId ? String(item.rackId) : null;
    if (!fromRackId) throw new Error('Item has no rack to transfer from');

    // ✅ rule: current rack must be occupied and assigned to same item
    const fromRack = await this.rackModel
      .findOne({
        _id: this.oid(fromRackId),
        isOccupied: true,
        itemId: this.oid(itemId),
      })
      .lean();

    if (!fromRack) throw new Error('Current rack is not occupied by this item');

    // then same flow: occupy new -> update item -> release old
    return this.changeItemRack(itemId, toRackId);
  }

  private async occupyRackIfFree(rackId: string, itemId: string) {
    const rack = await this.rackModel.findOneAndUpdate(
      {
        _id: this.oid(rackId),
        $or: [
          { isOccupied: false },
          { itemId: null },
          { itemId: { $exists: false } },
          { itemId: { $type: 'string' } }, // ✅ matches old "" safely
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

    if (!rack) throw new Error('Rack already occupied');
    return rack;
  }

  // private async releaseRackForItem(rackId: string, itemId: string) {
  //   // Only release if this rack really belongs to this item
  //   const res = await this.rackModel.updateOne(
  //     { _id: this.oid(rackId), itemId: this.oid(itemId) },
  //     { $set: { isOccupied: false, itemId: null } },
  //   );
  //   return res.modifiedCount > 0;
  // }

  // private oid(id?: string) {
  //   if (!id) return null;
  //   if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ObjectId');
  //   return new Types.ObjectId(id);
  // }

  private hasAnyQty(item: any) {
    return (
      (Number(item.totalStockQuantity) || 0) > 0 ||
      (Number(item.stockAvailableQuantity) || 0) > 0 ||
      (Number(item.stockIssueQuantity) || 0) > 0 ||
      (Number(item.stockissueCompleted) || 0) > 0 ||
      (Number(item.stockscrapQuantity) || 0) > 0
    );
  }

  /// ✅ for UI Transfer Rack (allowed only when qty==0)
  async transferRack(itemId: string, toRackId: string) {
    const item = await this.model.findById(this.oid(itemId)).lean();
    if (!item) throw new BadRequestException('Item not found');

    if (this.hasAnyQty(item)) {
      throw new BadRequestException(
        'Rack transfer allowed only when item quantity is 0',
      );
    }

    return this.changeItemRack(itemId, toRackId);
  }

  /// ✅ Transfer Item quantity (Available qty)
  /// UI requires destination rack MUST be from "same item racks" list
  async transferItemQty(
    itemId: string,
    fromRackId: string,
    toRackId: string,
    qty: number,
  ) {
    const item = await this.model.findById(this.oid(itemId)).lean();
    if (!item) throw new BadRequestException('Item not found');

    const realFromRackId = item.rackId ? String(item.rackId) : null;
    if (!realFromRackId) throw new BadRequestException('Item has no rack');
    if (String(fromRackId) !== realFromRackId) {
      throw new BadRequestException('fromRackId mismatch');
    }
    if (realFromRackId === toRackId) return true;

    const available = Number(item.stockAvailableQuantity) || 0;
    if (qty <= 0 || qty > available) {
      throw new BadRequestException(`Invalid qty. Must be 1..${available}`);
    }

    // destination item record: same itemNameId + toRackId
    const dest = await this.model
      .findOne({
        itemNameId: item.itemNameId,
        rackId: this.oid(toRackId),
      })
      .lean();

    if (!dest) {
      // strict mode (matches your UI: "fetch same item racks then transfer")
      throw new BadRequestException(
        'Destination rack is not mapped to the same item',
      );
    }

    // ✅ ensure destination rack is occupied by destination item OR fix if empty
    await this.occupyRackIfFreeOrOwned(toRackId, String(dest._id));

    // 1) decrement source (guarded)
    const dec = await this.model.updateOne(
      { _id: this.oid(itemId), stockAvailableQuantity: { $gte: qty } },
      {
        $inc: {
          stockAvailableQuantity: -qty,
          totalStockQuantity: -qty,
        },
      },
    );

    if (dec.modifiedCount <= 0) {
      throw new BadRequestException('Not enough available quantity');
    }

    // 2) increment destination
    const inc = await this.model.updateOne(
      { _id: this.oid(String(dest._id)) },
      {
        $inc: {
          stockAvailableQuantity: qty,
          totalStockQuantity: qty,
        },
      },
    );

    if (inc.modifiedCount <= 0) {
      // rollback
      await this.model.updateOne(
        { _id: this.oid(itemId) },
        { $inc: { stockAvailableQuantity: qty, totalStockQuantity: qty } },
      );
      throw new BadRequestException('Destination update failed');
    }

    return true;
  }

  /// Used by websocket: get racks that already contain same item (same itemNameId)

  async getSameItemRacks(itemId: string) {
    const item = await this.model.findById(this.oid(itemId)).lean();
    if (!item) throw new BadRequestException('Item not found');

    const others = await this.model
      .find({
        itemNameId: item.itemNameId,
        _id: { $ne: this.oid(itemId) },
      })
      .select({ rackId: 1 })
      .lean();

    const rackIds = others
      .map((x: any) => String(x.rackId || ''))
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (rackIds.length === 0) return [];

    const racks = await this.rackModel.find({ _id: { $in: rackIds } }).lean();

    // ✅ normalize for Flutter
    return racks;
    // .map((r: any) => ({
    //   id: String(r._id),
    //   name: r.name ?? '',
    //   code: r.code ?? '',
    //   roomId: r.roomId ? String(r.roomId) : null,
    //   isOccupied: !!r.isOccupied,
    //   itemId: r.itemId ? String(r.itemId) : null,
    // }));
  }

  /// ---------------------------
  /// Existing method (keep)
  /// ---------------------------
  async changeItemRack(itemId: string, toRackId: string) {
    const item = await this.model.findById(this.oid(itemId)).lean();
    if (!item) throw new BadRequestException('Item not found');

    const fromRackId = item.rackId ? String(item.rackId) : null;
    if (fromRackId && fromRackId === toRackId) return true;

    await this.occupyRackIfFree(toRackId, itemId);

    await this.model.updateOne(
      { _id: this.oid(itemId) },
      { $set: { rackId: this.oid(toRackId) } },
    );

    if (fromRackId) {
      const released = await this.releaseRackForItem(fromRackId, itemId);
      if (!released) {
        await this.rackModel.updateOne(
          { _id: this.oid(toRackId), itemId: this.oid(itemId) },
          { $set: { isOccupied: false, itemId: null } },
        );
        throw new BadRequestException(
          'Old rack release failed (data mismatch)',
        );
      }
    }

    return true;
  }

  // /// ✅ IMPORTANT: NO `{ itemId: '' }` anywhere (prevents CastError)
  // private async occupyRackIfFree(rackId: string, itemId: string) {
  //   const rack = await this.rackModel.findOneAndUpdate(
  //     {
  //       _id: this.oid(rackId),
  //       $or: [
  //         { isOccupied: false },
  //         { itemId: null },
  //         { itemId: { $exists: false } },
  //         { itemId: { $type: 'string' } }, // catches old "" safely without casting
  //       ],
  //     },
  //     {
  //       $set: {
  //         isOccupied: true,
  //         itemId: this.oid(itemId),
  //       },
  //     },
  //     { new: true },
  //   );

  //   if (!rack) throw new BadRequestException('Rack already occupied');
  //   return rack;
  // }

  /// allow occupied by same item id (for destination item in transfer qty)
  private async occupyRackIfFreeOrOwned(rackId: string, itemId: string) {
    const rack = await this.rackModel
      .findOne({
        _id: this.oid(rackId),
      })
      .lean();

    if (!rack) throw new BadRequestException('Rack not found');

    // already owned by this item doc
    if (rack.itemId && String(rack.itemId) === itemId) return true;

    // otherwise must be free/dirty
    await this.occupyRackIfFree(rackId, itemId);
    return true;
  }

  private async releaseRackForItem(rackId: string, itemId: string) {
    const res = await this.rackModel.updateOne(
      { _id: this.oid(rackId), itemId: this.oid(itemId) },
      { $set: { isOccupied: false, itemId: null } },
    );
    return res.modifiedCount > 0;
  }
}
