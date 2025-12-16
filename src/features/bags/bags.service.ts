// src/bags/bags.service.ts
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

@Injectable()
export class BagsService {
  constructor(
    @InjectModel(Bag.name, 'store')
    private readonly bagModel: Model<BagDocument>,

    @InjectModel(Item.name, 'store') private readonly itemModel: Model<Item>,
  ) {}

  async create(dto: CreateBagDto) {
    // optional validation if you send maxQty from UI
    if (dto.maxQty != null && dto.itemStock > dto.maxQty) {
      throw new BadRequestException(
        `itemStock cannot exceed maxQty (${dto.maxQty})`,
      );
    }

    const bag = await this.bagModel.create(dto);

    // ✅ Increase item openingStock by bag stock
    await this.itemModel.findByIdAndUpdate(dto.itemId, {
      $inc: { openingStock: dto.itemStock },
    });

    return { status: true, msg: 'Bag created', data: bag };
  }

  // async findAll(): Promise<Bag[]> {
  //   return await this.bagModel.find().sort({ createdAt: -1 }).exec();
  // }

  async findOne(id: string): Promise<Bag> {
    const bag = await this.bagModel.findById(id).exec();
    if (!bag) {
      throw new NotFoundException('Bag not found');
    }
    return bag;
  }

  async update(id: string, dto: UpdateBagDto) {
    const old = await this.bagModel.findById(id);
    if (!old) throw new NotFoundException('Bag not found');

    // If itemId can change, handle transfer from old item to new item
    const oldItemId = old.itemId;
    const newItemId = dto.itemId ?? oldItemId;

    const oldStock = old.itemStock ?? 0;
    const newStock = dto.itemStock ?? oldStock;

    if (dto.maxQty != null && newStock > dto.maxQty) {
      throw new BadRequestException(
        `itemStock cannot exceed maxQty (${dto.maxQty})`,
      );
    }

    const updated = await this.bagModel.findByIdAndUpdate(id, dto, {
      new: true,
    });

    // ✅ Correct delta logic:
    // - If same item => inc by (newStock - oldStock)
    // - If item changed => decrement old item by oldStock, increment new item by newStock
    if (oldItemId === newItemId) {
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

    return { status: true, msg: 'Bag updated', data: updated };
  }
  async remove(id: string) {
    const old = await this.bagModel.findById(id);
    if (!old) throw new NotFoundException('Bag not found');

    await this.bagModel.deleteOne({ _id: id });

    // ✅ Decrease item openingStock by bag stock
    await this.itemModel.findByIdAndUpdate(old.itemId, {
      $inc: { openingStock: -(old.itemStock ?? 0) },
    });

    return { status: true, msg: 'Bag deleted' };
  }

  async findAll() {
    const bags = await this.bagModel.find().sort({ createdAt: -1 }).lean();
    return bags;
  }

  async transferToAnotherBag(dto: TransferBagDto) {
    const sourceId = new Types.ObjectId(dto.sourceBagId);
    const targetId = new Types.ObjectId(dto.targetBagId);

    if (dto.sourceBagId === dto.targetBagId) {
      throw new BadRequestException('Source and target bag cannot be the same');
    }

    const qty = Number(dto.qty) || 0;
    if (qty <= 0) throw new BadRequestException('qty must be > 0');

    const [source, target] = await Promise.all([
      this.bagModel.findById(sourceId),
      this.bagModel.findById(targetId),
    ]);

    if (!source) throw new NotFoundException('Source bag not found');
    if (!target) throw new NotFoundException('Target bag not found');

    // must be same item
    if (String(source.itemId) !== String(target.itemId)) {
      throw new BadRequestException('Target bag itemId mismatch');
    }

    // maxQty must exist
    const maxQty = Number(target.maxQty) || 0;
    if (maxQty <= 0) {
      throw new BadRequestException(
        `Target bag ${target.bagCode} maxQty not set`,
      );
    }

    // source must have stock
    if ((Number(source.itemStock) || 0) < qty) {
      throw new BadRequestException(
        `Source bag ${source.bagCode} has insufficient stock`,
      );
    }

    // target must not exceed maxQty
    const targetStock = Number(target.itemStock) || 0;
    if (targetStock + qty > maxQty) {
      throw new BadRequestException(
        `Target bag ${target.bagCode} exceeds maxQty (${maxQty}). Current=${targetStock}, adding=${qty}`,
      );
    }

    // ---- Atomic-ish update with rollback (no Mongo transaction needed) ----
    // 1) decrement source only if enough stock
    const decRes = await this.bagModel.updateOne(
      { _id: sourceId, itemStock: { $gte: qty } },
      {
        $inc: { itemStock: -qty,  transferQty: qty },
        // $set: { transferType: 'other_bag' },
        // $inc: { },
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

    // if target update fails => rollback source update
    if (incRes.modifiedCount !== 1) {
      await this.bagModel.updateOne(
        { _id: sourceId },
        { $inc: { itemStock: qty, itemUsed: -qty, transferQty: -qty } },
      );
      throw new BadRequestException(
        'Failed to increment target bag (maxQty constraint or conflict)',
      );
    }

    // broadcast latest bags to websocket listeners
    // await this.bagGateway.emitAllBags();

    return { sourceBagId: dto.sourceBagId, targetBagId: dto.targetBagId, qty };
  }
}
