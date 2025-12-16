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
@Injectable()
export class BagsService {
  constructor(
    @InjectModel(Bag.name, 'store')
    private readonly bagModel: Model<BagDocument>,

    @InjectModel(Item.name, 'store')
    private readonly itemModel: Model<Item>,

    private readonly activity: ActivityLogsService,
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
    if (dto.maxQty != null && dto.itemStock > dto.maxQty) {
      throw new BadRequestException(
        `itemStock cannot exceed maxQty (${dto.maxQty})`,
      );
    }

    const itemBefore = await this.itemModel.findById(dto.itemId).lean();

    const bag = await this.bagModel.create(dto);

    // ✅ Increase item openingStock by bag stock
    await this.itemModel.findByIdAndUpdate(dto.itemId, {
      $inc: { openingStock: dto.itemStock },
    });

    const itemAfter = await this.itemModel.findById(dto.itemId).lean();

    await this.activity.log({
      module: 'bags',
      action: 'create',
      eventKey: 'bags.create',
      actor: dto.createdBy
        ? { userId: dto.createdBy } // ✅ from Flutter uid
        : actor,
      entities: [
        { type: 'Bag', id: bag._id!.toString(), label: bag.bagCode },
        { type: 'Item', id: String(dto.itemId), label: dto.itemName ?? '' },
      ],
      changes: {
        before: { item: this.itemSnap(itemBefore) },
        after: { bag: this.bagSnap(bag), item: this.itemSnap(itemAfter) },
        delta: {
          itemOpeningStock: Number(dto.itemStock) || 0,
        },
      },
      meta: { dto },
    });

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

    const oldItemId = old.itemId;
    const newItemId = (dto.itemId ?? oldItemId) as any;

    const oldStock = Number(old.itemStock) || 0;
    const newStock =
      dto.itemStock == null ? oldStock : Number(dto.itemStock) || 0;

    if (dto.maxQty != null && newStock > dto.maxQty) {
      throw new BadRequestException(
        `itemStock cannot exceed maxQty (${dto.maxQty})`,
      );
    }

    const itemOldBefore = await this.itemModel.findById(oldItemId).lean();
    const itemNewBefore =
      String(oldItemId) === String(newItemId)
        ? null
        : await this.itemModel.findById(newItemId).lean();

    const updated = await this.bagModel.findByIdAndUpdate(id, dto, {
      new: true,
    });

    if (!updated) throw new NotFoundException('Bag not found after update');

    // ✅ stock delta logic for item openingStock
    if (String(oldItemId) === String(newItemId)) {
      const delta = newStock - oldStock;
      if (delta !== 0) {
        await this.itemModel.findByIdAndUpdate(oldItemId, {
          $inc: { openingStock: delta },
        });
      }
    } else {
      await this.itemModel.findByIdAndUpdate(oldItemId, {
        $inc: { openingStock: -oldStock },
      });
      await this.itemModel.findByIdAndUpdate(newItemId, {
        $inc: { openingStock: newStock },
      });
    }

    const itemOldAfter = await this.itemModel.findById(oldItemId).lean();
    const itemNewAfter =
      String(oldItemId) === String(newItemId)
        ? null
        : await this.itemModel.findById(newItemId).lean();

    await this.activity.log({
      module: 'bags',
      action: 'update',
      eventKey: 'bags.update',
      actor: dto.createdBy
        ? { userId: dto.createdBy } // ✅ from Flutter uid
        : actor,
      entities: [
        { type: 'Bag', id: String(id), label: updated.bagCode },
        {
          type: 'Item',
          id: String(oldItemId),
          label: itemOldAfter?.name ?? '',
        },
        ...(String(oldItemId) === String(newItemId)
          ? []
          : [
              {
                type: 'Item',
                id: String(newItemId),
                label: itemNewAfter?.name ?? '',
              },
            ]),
      ],
      changes: {
        before: {
          bag: oldSnap,
          oldItem: this.itemSnap(itemOldBefore),
          newItem: this.itemSnap(itemNewBefore),
        },
        after: {
          bag: this.bagSnap(updated),
          oldItem: this.itemSnap(itemOldAfter),
          newItem: this.itemSnap(itemNewAfter),
        },
        delta: {
          bagStock: newStock - oldStock,
          itemOpeningStock:
            String(oldItemId) === String(newItemId)
              ? newStock - oldStock
              : { oldItem: -oldStock, newItem: newStock },
        },
      },
      meta: { dto },
    });

    return { status: true, msg: 'Bag updated', data: updated };
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

    await this.activity.log({
      module: 'bags',
      action: 'delete',
      eventKey: 'bags.delete',
      actor: createdBy
        ? { userId: createdBy } // ✅ from Flutter uid
        : actor,
      entities: [
        { type: 'Bag', id: String(id), label: old.bagCode },
        { type: 'Item', id: String(old.itemId), label: itemAfter?.name ?? '' },
      ],
      changes: {
        before: { bag: oldSnap, item: this.itemSnap(itemBefore) },
        after: { bag: null, item: this.itemSnap(itemAfter) },
        delta: { itemOpeningStock: dec },
      },
      meta: {},
    });

    return { status: true, msg: 'Bag deleted' };
  }

  async findAll() {
    const bags = await this.bagModel.find().sort({ createdAt: -1 }).lean();
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

    await this.activity.log({
      module: 'bags',
      action: 'transfer',
      eventKey: 'bags.transfer.other_bag',
      actor: dto.createdBy
        ? { userId: dto.createdBy } // ✅ from Flutter uid
        : actor,
      entities: [
        {
          type: 'Bag',
          id: String(dto.sourceBagId),
          label: sourceBefore.bagCode,
        },
        {
          type: 'Bag',
          id: String(dto.targetBagId),
          label: targetBefore.bagCode,
        },
        {
          type: 'Item',
          id: String(sourceBefore.itemId),
          label: sourceBefore.itemName ?? '',
        },
      ],
      changes: {
        before: {
          source: this.bagSnap(sourceBefore),
          target: this.bagSnap(targetBefore),
        },
        after: {
          source: this.bagSnap(sourceAfter),
          target: this.bagSnap(targetAfter),
        },
        delta: {
          qty,
          source: { itemStock: -qty, itemUsed: +qty, transferQty: +qty },
          target: { itemStock: +qty },
        },
      },
      meta: {
        sourceBagId: dto.sourceBagId,
        targetBagId: dto.targetBagId,
        qty,
        maxQty,
      },
    });

    return {
      status: true,
      msg: 'Transferred',
      sourceBagId: dto.sourceBagId,
      targetBagId: dto.targetBagId,
      qty,
    };
  }
}
