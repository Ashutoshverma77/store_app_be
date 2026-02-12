import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateBagDto } from './dto/create-bag.dto';
import { UpdateBagDto } from './dto/update-bag.dto';
import { Bag, BagDocument } from './entities/bag.schema';
import { Item } from '../items/entities/item.schema';
import { TransferBagDto } from './dto/transfer-bag.dto';
import {
  ActivityLogsService,
  ActivityActorInput,
} from '../activity/activity.service';
import { AddBagStockDto } from './dto/add-bag-stock.dto';
@Injectable()
export class BagsService {
  constructor(
    @InjectModel(Bag.name, 'store')
    private readonly bagModel: Model<BagDocument>,

    @InjectModel(Item.name, 'store')
    private readonly itemModel: Model<Item>,

    // private readonly activity: ActivityLogsService,
  ) {}

  // helper: safe snapshots (avoid huge doc fields)
  private bagSnap(bag: any) {
    if (!bag) return null;
    return {
      id: bag._id?.toString?.() ?? bag.id,
      itemId: bag.itemId?.toString?.() ?? bag.itemId,
      bagCode: bag.bagCode,
      itemName: bag.itemName,
      itemStock: Number(bag.itemStock) || 0,
      itemUsed: Number(bag.itemUsed) || 0,
      maxQty: bag.maxQty == null ? null : Number(bag.maxQty) || 0,
      transferQty: Number(bag.transferQty) || 0,
      transferType: bag.transferType,
    };
  }

  private itemSnap(item: any) {
    if (!item) return null;
    return {
      id: item._id?.toString?.() ?? item.id,
      code: item.code,
      name: item.name,
      openingStock: Number(item.openingStock) || 0,
      unit: item.unit,
    };
  }

  async create(dto: CreateBagDto, actor?: ActivityActorInput) {
    const maxQty = Number(dto.maxQty) || 0;
    if (maxQty <= 0) {
      throw new BadRequestException('maxQty must be > 0');
    }

    // ✅ force create rules
    const payload: any = {
      bagCode: dto.bagCode,
      maxQty,
      itemStock: 0,
      itemUsed: 0,
      approvedStatus: 'pending',
      transferQty: 0,
      transferType: 'inStock',
      itemId: '',
      itemName: '',
    };

    const bag = await this.bagModel.create(payload);

    // ✅ DO NOT touch item openingStock because no item is linked + stock is 0

    // await this.activity.log({
    //   module: 'bags',
    //   action: 'create',
    //   eventKey: 'bags.create',
    //   actor: dto.createdBy ? { userId: dto.createdBy } : actor,
    //   entities: [{ type: 'Bag', id: bag._id!.toString(), label: bag.bagCode }],
    //   changes: {
    //     before: {},
    //     after: { bag: this.bagSnap(bag) },
    //     delta: { itemOpeningStock: 0, bagStock: 0 },
    //   },
    //   meta: { dto: { bagCode: dto.bagCode, maxQty } },
    // });

    return { status: true, msg: 'Bag created', data: bag };
  }

  async findOne(id: string): Promise<Bag> {
    const bag = await this.bagModel.findById(id).exec();
    if (!bag) {
      throw new NotFoundException('Bag not found');
    }
    return bag;
  }

  async update(id: string, dto: UpdateBagDto, actor?: ActivityActorInput) {
    const old = await this.bagModel.findById(id);
    if (!old) throw new NotFoundException('Bag not found');

    const oldSnap = this.bagSnap(old);

    const oldStock = Number(old.itemStock) || 0;
    const newStock =
      dto.itemStock == null ? oldStock : Number(dto.itemStock) || 0;

    // maxQty guard
    const maxQty =
      dto.maxQty == null ? Number(old.maxQty) || 0 : Number(dto.maxQty) || 0;
    if (maxQty <= 0) throw new BadRequestException('maxQty must be > 0');
    if (newStock > maxQty) {
      throw new BadRequestException(
        `itemStock cannot exceed maxQty (${maxQty})`,
      );
    }

    // ✅ rule: item change only allowed when stock == 0
    const oldItemId = old.itemId ? String(old.itemId) : '';
    const dtoItemId = dto.itemId == null ? undefined : String(dto.itemId);
    const newItemId = dtoItemId ?? oldItemId; // if not provided, keep

    const isItemChanging = dtoItemId != null && dtoItemId !== oldItemId;

    if (isItemChanging && oldStock > 0) {
      throw new BadRequestException('Cannot change item when bag stock > 0');
    }

    // if itemId is being set/changed, also set itemName if provided
    const updated = await this.bagModel.findByIdAndUpdate(
      id,
      {
        ...dto,
        maxQty,
        // if user passes empty, normalize
        ...(dtoItemId ? { itemId: dtoItemId } : {}),
      },
      { new: true },
    );

    if (!updated) throw new NotFoundException('Bag not found after update');

    // ✅ openingStock delta logic only when itemId exists
    // Case A: no item attached => do nothing
    // Case B: item attached and stock changed => openingStock += (newStock - oldStock)
    const finalItemId = updated.itemId ? String(updated.itemId) : '';

    let itemAfterSnap: any = null;
    let itemBeforeSnap: any = null;

    if (finalItemId) {
      const delta = newStock - oldStock;
      if (delta !== 0) {
        const itemBefore = await this.itemModel.findById(finalItemId).lean();
        await this.itemModel.findByIdAndUpdate(finalItemId, {
          $inc: { openingStock: delta },
        });
        const itemAfter = await this.itemModel.findById(finalItemId).lean();
        itemBeforeSnap = this.itemSnap(itemBefore);
        itemAfterSnap = this.itemSnap(itemAfter);
      }
    }

    // await this.activity.log({
    //   module: 'bags',
    //   action: 'update',
    //   eventKey: 'bags.update',
    //   actor: (dto as any).createdBy
    //     ? { userId: (dto as any).createdBy }
    //     : actor,
    //   entities: [{ type: 'Bag', id: String(id), label: updated.bagCode }],
    //   changes: {
    //     before: { bag: oldSnap, item: itemBeforeSnap },
    //     after: { bag: this.bagSnap(updated), item: itemAfterSnap },
    //     delta: {
    //       bagStock: newStock - oldStock,
    //       itemIdChanged: isItemChanging,
    //     },
    //   },
    //   meta: { dto },
    // });

    return { status: true, msg: 'Bag updated', data: updated };
  }

  async addStock(id: string, dto: AddBagStockDto, actor?: ActivityActorInput) {
    const qty = Number(dto.qty) || 0;
    if (qty <= 0) throw new BadRequestException('qty must be > 0');

    const bag = await this.bagModel.findById(id);
    if (!bag) throw new NotFoundException('Bag not found');

    const bagBefore = this.bagSnap(bag);

    const itemId = bag.itemId ? String(bag.itemId) : '';
    if (!itemId)
      throw new BadRequestException('Bag has no item. Set item first.');

    const maxQty = Number(bag.maxQty) || 0;
    if (maxQty <= 0) throw new BadRequestException('Bag maxQty not set');

    const cur = Number(bag.itemStock) || 0;
    if (cur + qty > maxQty) {
      throw new BadRequestException(
        `Cannot exceed maxQty. maxQty=${maxQty}, current=${cur}, adding=${qty}`,
      );
    }

    const itemBefore = await this.itemModel.findById(itemId).lean();
    if (!itemBefore) throw new NotFoundException('Item not found');

    // atomic-ish
    const bagRes = await this.bagModel.updateOne(
      { _id: bag._id, itemStock: { $lte: maxQty - qty } },
      { $inc: { itemStock: qty } },
    );
    if (bagRes.modifiedCount !== 1) {
      throw new BadRequestException('Failed to add stock (maxQty constraint)');
    }

    const itemRes = await this.itemModel.updateOne(
      { _id: itemId },
      { $inc: { openingStock: qty } },
    );
    if (itemRes.modifiedCount !== 1) {
      // rollback bag
      await this.bagModel.updateOne(
        { _id: bag._id },
        { $inc: { itemStock: -qty } },
      );
      throw new BadRequestException('Failed to update item openingStock');
    }

    const bagAfter = await this.bagModel.findById(id).lean();
    const itemAfter = await this.itemModel.findById(itemId).lean();

    // await this.activity.log({
    //   module: 'bags',
    //   action: 'add_stock',
    //   eventKey: 'bags.add_stock',
    //   actor: dto.createdBy ? { userId: dto.createdBy } : actor,
    //   entities: [
    //     { type: 'Bag', id: String(id), label: bag.bagCode },
    //     { type: 'Item', id: itemId, label: itemAfter?.name ?? '' },
    //   ],
    //   changes: {
    //     before: { bag: bagBefore, item: this.itemSnap(itemBefore) },
    //     after: { bag: this.bagSnap(bagAfter), item: this.itemSnap(itemAfter) },
    //     delta: { qtyAdded: qty, bagStock: qty, itemOpeningStock: qty },
    //   },
    //   meta: { dto },
    // });

    return { status: true, msg: 'Stock added', data: bagAfter };
  }

  async remove(id: string, createdBy?: string, actor?: ActivityActorInput) {
    const old = await this.bagModel.findById(id);
    if (!old) throw new NotFoundException('Bag not found');

    const oldSnap = this.bagSnap(old);
    const itemBefore = await this.itemModel.findById(old.itemId).lean();

    await this.bagModel.deleteOne({ _id: id });

    // ✅ Decrease item openingStock by bag stock
    const dec = -(Number(old.itemStock) || 0);
    await this.itemModel.findByIdAndUpdate(old.itemId, {
      $inc: { openingStock: dec },
    });

    const itemAfter = await this.itemModel.findById(old.itemId).lean();

    // await this.activity.log({
    //   module: 'bags',
    //   action: 'delete',
    //   eventKey: 'bags.delete',
    //   actor: createdBy
    //     ? { userId: createdBy } // ✅ from Flutter uid
    //     : actor,
    //   entities: [
    //     { type: 'Bag', id: String(id), label: old.bagCode },
    //     { type: 'Item', id: String(old.itemId), label: itemAfter?.name ?? '' },
    //   ],
    //   changes: {
    //     before: { bag: oldSnap, item: this.itemSnap(itemBefore) },
    //     after: { bag: null, item: this.itemSnap(itemAfter) },
    //     delta: { itemOpeningStock: dec },
    //   },
    //   meta: {},
    // });

    return { status: true, msg: 'Bag deleted' };
  }

  async findAll() {
    const bags = await this.bagModel
      .find({ approvedStatus: { $in: ['pending', 'approved'] } })
      .sort({ createdAt: -1 })
      .lean();
    return bags;
  }

  async transferToAnotherBag(dto: TransferBagDto, actor?: ActivityActorInput) {
    const sourceId = new Types.ObjectId(dto.sourceBagId);
    const targetId = new Types.ObjectId(dto.targetBagId);

    if (dto.sourceBagId === dto.targetBagId) {
      throw new BadRequestException('Source and target bag cannot be the same');
    }

    const qty = Number(dto.qty) || 0;
    if (qty <= 0) throw new BadRequestException('qty must be > 0');

    const [sourceBefore, targetBefore] = await Promise.all([
      this.bagModel.findById(sourceId).lean(),
      this.bagModel.findById(targetId).lean(),
    ]);

    if (!sourceBefore) throw new NotFoundException('Source bag not found');
    if (!targetBefore) throw new NotFoundException('Target bag not found');

    if (String(sourceBefore.itemId) !== String(targetBefore.itemId)) {
      throw new BadRequestException('Target bag itemId mismatch');
    }

    const maxQty = Number(targetBefore.maxQty) || 0;
    if (maxQty <= 0) {
      throw new BadRequestException(
        `Target bag ${targetBefore.bagCode} maxQty not set`,
      );
    }

    const sourceStock = Number(sourceBefore.itemStock) || 0;
    if (sourceStock < qty) {
      throw new BadRequestException(
        `Source bag ${sourceBefore.bagCode} has insufficient stock`,
      );
    }

    const targetStock = Number(targetBefore.itemStock) || 0;
    if (targetStock + qty > maxQty) {
      throw new BadRequestException(
        `Target bag ${targetBefore.bagCode} exceeds maxQty (${maxQty}). Current=${targetStock}, adding=${qty}`,
      );
    }

    // ---- Atomic-ish update with rollback (no Mongo transaction needed) ----
    // 1) decrement source only if enough stock
    const decRes = await this.bagModel.updateOne(
      { _id: sourceId, itemStock: { $gte: qty } },
      {
        $inc: { itemStock: -qty, transferQty: qty, itemUsed: qty },
        $set: { transferType: 'other_bag' },
      },
    );

    if (decRes.modifiedCount !== 1) {
      throw new BadRequestException('Failed to decrement source bag stock');
    }

    // 2) increment target only if it won’t exceed maxQty
    const incRes = await this.bagModel.updateOne(
      { _id: targetId, itemStock: { $lte: maxQty - qty } },
      { $inc: { itemStock: qty }, $set: { transferType: 'inStock' } },
    );

    if (incRes.modifiedCount !== 1) {
      // rollback source update
      await this.bagModel.updateOne(
        { _id: sourceId },
        { $inc: { itemStock: qty, itemUsed: -qty, transferQty: -qty } },
      );
      throw new BadRequestException(
        'Failed to increment target bag (maxQty constraint or conflict)',
      );
    }

    const [sourceAfter, targetAfter] = await Promise.all([
      this.bagModel.findById(sourceId).lean(),
      this.bagModel.findById(targetId).lean(),
    ]);

    // await this.activity.log({
    //   module: 'bags',
    //   action: 'transfer',
    //   eventKey: 'bags.transfer.other_bag',
    //   actor: dto.createdBy
    //     ? { userId: dto.createdBy } // ✅ from Flutter uid
    //     : actor,
    //   entities: [
    //     {
    //       type: 'Bag',
    //       id: String(dto.sourceBagId),
    //       label: sourceBefore.bagCode,
    //     },
    //     {
    //       type: 'Bag',
    //       id: String(dto.targetBagId),
    //       label: targetBefore.bagCode,
    //     },
    //     {
    //       type: 'Item',
    //       id: String(sourceBefore.itemId),
    //       label: sourceBefore.itemName ?? '',
    //     },
    //   ],
    //   changes: {
    //     before: {
    //       source: this.bagSnap(sourceBefore),
    //       target: this.bagSnap(targetBefore),
    //     },
    //     after: {
    //       source: this.bagSnap(sourceAfter),
    //       target: this.bagSnap(targetAfter),
    //     },
    //     delta: {
    //       qty,
    //       source: { itemStock: -qty, itemUsed: +qty, transferQty: +qty },
    //       target: { itemStock: +qty },
    //     },
    //   },
    //   meta: {
    //     sourceBagId: dto.sourceBagId,
    //     targetBagId: dto.targetBagId,
    //     qty,
    //     maxQty,
    //   },
    // });

    return {
      status: true,
      msg: 'Transferred',
      sourceBagId: dto.sourceBagId,
      targetBagId: dto.targetBagId,
      qty,
    };
  }
}
