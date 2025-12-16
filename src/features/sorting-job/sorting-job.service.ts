// src/sorting-jobs/sorting-jobs.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SortingJob, SortingJobDocument } from './entities/sorting-job.schema';
import { Bag, BagDocument } from '../bags/entities/bag.schema';
import { Item, ItemDocument } from '../items/entities/item.schema';
import { Model, Types } from 'mongoose';
import { TransferSortingJobDto } from './dto/complete-sorting-job.dto';
import { CreateSortingJobDto } from './dto/create-sorting-job.dto';
import { TransferToBagDto } from './dto/transfer-to-bag.dto';
// import { Model, Types } from 'mongoose';
// import { SortingJob, SortingJobDocument } from './schemas/sorting-job.schema';
// import { CreateSortingJobDto } from './dto/create-sorting-job.dto';
// import { TransferSortingJobDto } from './dto/transfer-sorting-job.dto';
// import { Bag, BagDocument } from '../bags/schemas/bag.schema';
// import { Item, ItemDocument } from '../items/schemas/item.schema';
// import { SortingJobsGateway } from './sorting-jobs.gateway';
// import { BagsGateway } from '../bags/bags.gateway';
// import { ItemsGateway } from '../items/items.gateway';

@Injectable()
export class SortingJobsService {
  constructor(
    @InjectModel(SortingJob.name, 'store')
    private jobModel: Model<SortingJobDocument>,
    @InjectModel(Bag.name, 'store') private bagModel: Model<BagDocument>,
    @InjectModel(Item.name, 'store') private itemModel: Model<ItemDocument>,
    // private readonly jobsGateway: SortingJobsGateway,
    // private readonly bagsGateway: BagsGateway,
    // private readonly itemsGateway: ItemsGateway,
  ) {}

  async findAll() {
    return this.jobModel.find().sort({ createdAt: -1 }).lean();
  }

  async findById(id: string) {
    const job = await this.jobModel.findById(id).lean();
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  // CREATE JOB: subtract from bag stock and item opening stock
  async create(dto: CreateSortingJobDto) {
    const itemId = new Types.ObjectId(dto.itemId);
    const item = await this.itemModel.findById(itemId);
    if (!item) throw new NotFoundException('Item not found');

    if (!dto.inputBags?.length) {
      throw new BadRequestException('inputBags required');
    }

    // validate no duplicate bag selection
    const bagKeySet = new Set<string>();
    for (const b of dto.inputBags) {
      const key = (b.bagId ?? b.bagCode).toString();
      if (bagKeySet.has(key)) {
        throw new BadRequestException('Same bag cannot be selected twice');
      }
      bagKeySet.add(key);
    }

    const totalInputQtyInWt = dto.inputBags.reduce(
      (s, b) => s + (Number(b.qtyInWt) || 0),
      0,
    );

    if (totalInputQtyInWt <= 0) {
      throw new BadRequestException('Total input qty must be > 0');
    }

    if ((item.openingStock ?? 0) < totalInputQtyInWt) {
      throw new BadRequestException(
        `Item opening stock insufficient. Need ${totalInputQtyInWt}, have ${item.openingStock}`,
      );
    }

    // Apply bag updates (stock - , used +)
    for (const b of dto.inputBags) {
      const qty = Number(b.qtyInWt) || 0;
      if (qty <= 0) throw new BadRequestException('qtyInWt must be > 0');

      // locate bag by id primarily; fallback by code (optional)
      const bag = b.bagId
        ? await this.bagModel.findById(b.bagId)
        : await this.bagModel.findOne({ bagCode: b.bagCode });

      if (!bag) throw new NotFoundException(`Bag not found: ${b.bagCode}`);
      if (bag.itemId.toString() !== itemId.toString()) {
        throw new BadRequestException(
          `Bag ${bag.bagCode} does not belong to selected item`,
        );
      }

      if ((bag.itemStock ?? 0) < qty) {
        throw new BadRequestException(
          `Bag ${bag.bagCode} has insufficient stock. Need ${qty}, have ${bag.itemStock}`,
        );
      }

      bag.itemStock = (bag.itemStock ?? 0) - qty;
      bag.itemUsed = (bag.itemUsed ?? 0) + qty;
      await bag.save();
    }

    // Update item opening stock
    item.openingStock = (item.openingStock ?? 0) - totalInputQtyInWt;
    await item.save();

    // Create job
    const created = await this.jobModel.create({
      machineName: dto.machineName,
      itemId,
      itemName: dto.itemName,
      status: 'created',
      inputBags: dto.inputBags.map((x) => ({
        bagId: x.bagId ? new Types.ObjectId(x.bagId) : undefined,
        bagCode: x.bagCode,
        qtyInWt: Number(x.qtyInWt) || 0,
        transferQtyInWt: 0,
      })),
      totalInputQtyInBags: dto.inputBags.length,
      totalInputQtyInWt,
      totalTransferQtyInWt: 0,
    });

    // broadcast updated data
    // await this.bagsGateway.emitAllBags();
    // await this.itemsGateway.emitAllItems();
    // await this.jobsGateway.emitAllJobs();

    return created;
  }

  async start(id: string) {
    const job = await this.jobModel.findById(id);
    if (!job) throw new NotFoundException('Job not found');
    if (job.status === 'completed')
      throw new BadRequestException('Job already completed');

    job.status = 'started';
    job.startedAt = new Date();
    await job.save();

    // await this.jobsGateway.emitAllJobs();
    return job;
  }

  // TRANSFER one-by-one for a specific input bag
  async transferOne(id: string, dto: TransferSortingJobDto) {
    const job = await this.jobModel.findById(id);
    if (!job) throw new NotFoundException('Job not found');
    if (job.status === 'completed')
      throw new BadRequestException('Job already completed');

    const transferWt = Number(dto.transferQtyInWt) || 0;
    if (transferWt <= 0) {
      throw new BadRequestException('transferQtyInWt must be > 0');
    }

    const totalInputWt = Number(job.totalInputQtyInWt) || 0;
    const alreadyTransferredWt = Number(job.totalTransferQtyInWt) || 0;
    const remainingWt = totalInputWt - alreadyTransferredWt;

    if (remainingWt < 0) {
      throw new BadRequestException(
        'Job totals corrupted (transferred > input)',
      );
    }
    if (transferWt > remainingWt) {
      throw new BadRequestException(
        `Transfer exceeds remaining. Remaining=${remainingWt}, asked=${transferWt}`,
      );
    }

    // find input bag inside job
    const idx = job.inputBags.findIndex((b) => {
      if (dto.bagId) return b.bagId?.toString() === dto.bagId;
      return b.bagCode === dto.bagCode;
    });

    if (idx === -1) {
      throw new BadRequestException('This bag is not part of job inputBags');
    }

    const inputBag = job.inputBags[idx];
    const bagRemaining =
      (Number(inputBag.qtyInWt) || 0) - (Number(inputBag.transferQtyInWt) || 0);

    if (bagRemaining < 0) {
      throw new BadRequestException('Bag transfer totals corrupted');
    }
    if (transferWt > bagRemaining) {
      throw new BadRequestException(
        `Bag transfer exceeds remaining for bag ${inputBag.bagCode}. Remaining=${bagRemaining}, asked=${transferWt}`,
      );
    }

    // update bag stock back + used -
    const bagDoc = inputBag.bagId
      ? await this.bagModel.findById(inputBag.bagId)
      : await this.bagModel.findOne({ bagCode: inputBag.bagCode });

    if (!bagDoc) throw new NotFoundException('Target bag not found');

    // add stock back
    bagDoc.itemStock = (bagDoc.itemStock ?? 0) + transferWt;
    // reduce used back (never negative)
    bagDoc.itemUsed = Math.max(0, (bagDoc.itemUsed ?? 0) - transferWt);
    await bagDoc.save();

    // update item opening stock back
    const item = await this.itemModel.findById(job.itemId);
    if (!item) throw new NotFoundException('Item not found');
    item.openingStock = (item.openingStock ?? 0) + transferWt;
    await item.save();

    // update job input bag transfer and total transfer
    inputBag.transferQtyInWt =
      (Number(inputBag.transferQtyInWt) || 0) + transferWt;
    job.totalTransferQtyInWt = alreadyTransferredWt + transferWt;

    // mark completed when fully transferred
    if (job.totalTransferQtyInWt === job.totalInputQtyInWt) {
      job.status = 'completed';
      job.completedAt = new Date();
    } else {
      // keep started if it was created earlier
      if (job.status === 'created') job.status = 'started';
    }

    await job.save();

    // await this.bagsGateway.emitAllBags();
    // await this.itemsGateway.emitAllItems();
    // await this.jobsGateway.emitAllJobs();

    return job;
  }

  async transferToAnotherBag(jobId: string, dto: TransferToBagDto) {
    const job = await this.jobModel.findById(jobId);
    if (!job) throw new NotFoundException('Job not found');
    if (job.status === 'completed')
      throw new BadRequestException('Job already completed');

    const sourceBagId = new Types.ObjectId(dto.sourceBagId);
    const targetBagId = new Types.ObjectId(dto.targetBagId);

    if (sourceBagId.equals(targetBagId)) {
      throw new BadRequestException('Target bag cannot be same as source bag');
    }

    const qty = Number(dto.transferQtyInWt) || 0;
    if (qty <= 0) throw new BadRequestException('transferQtyInWt must be > 0');

    const inputWtTotal = Number(job.totalInputQtyInWt) || 0;
    const alreadyTransferredWt = Number(job.totalTransferQtyInWt) || 0;
    const remainingOverall = inputWtTotal - alreadyTransferredWt;

    if (remainingOverall < 0) {
      throw new BadRequestException('Job data corrupted: transferred > input');
    }
    if (qty > remainingOverall) {
      throw new BadRequestException(
        `Transfer exceeds remaining overall wt. Remaining=${remainingOverall}, requested=${qty}`,
      );
    }

    // Find source inputBag row
    const inputRow = (job.inputBags || []).find((b: any) => {
      const id = b.bagId ? b.bagId.toString() : '';
      return id === sourceBagId.toString();
    });

    if (!inputRow) {
      throw new BadRequestException(
        'sourceBagId is not part of this job inputBags',
      );
    }

    const sourceInputQty = Number(inputRow.qtyInWt) || 0;
    const sourceTransferred = Number(inputRow.transferQtyInWt) || 0;
    const sourceRemaining = sourceInputQty - sourceTransferred;

    if (sourceRemaining < 0) {
      throw new BadRequestException('Job input row corrupted: transfer > qty');
    }
    if (qty > sourceRemaining) {
      throw new BadRequestException(
        `Transfer exceeds source remaining wt. Remaining=${sourceRemaining}, requested=${qty}`,
      );
    }

    // Load bags
    const targetBag = await this.bagModel.findById(targetBagId);
    if (!targetBag) throw new NotFoundException('Target bag not found');

    // Must be same itemId as job
    if (targetBag.itemId.toString() !== job.itemId.toString()) {
      throw new BadRequestException('Target bag itemId mismatch');
    }

    const maxQty = Number(targetBag.maxQty) || 0;
    if (maxQty <= 0)
      throw new BadRequestException(
        `Target bag maxQty not set for ${targetBag.bagCode}`,
      );

    const targetCurrent = Number(targetBag.itemStock) || 0;
    if (targetCurrent + qty > maxQty) {
      throw new BadRequestException(
        `Target bag exceeds maxQty. maxQty=${maxQty}, current=${targetCurrent}, add=${qty}`,
      );
    }

    // We will update:
    // 1) targetBag.itemStock += qty  (guarded by maxQty)
    // 2) item.openingStock += qty
    // 3) job.inputBags[source].transferQtyInWt += qty AND job.totalTransferQtyInWt += qty
    // 4) if fully transferred => status completed
    //
    // rollback best-effort
    const rollback = {
      incTargetBag: false,
      incItem: false,
      incJob: false,
    };

    try {
      // 1) increment target bag with maxQty guard (atomic condition)
      const bagRes = await this.bagModel.updateOne(
        { _id: targetBagId, itemStock: { $lte: maxQty - qty } },
        { $inc: { itemStock: qty } },
      );
      if (bagRes.modifiedCount !== 1) {
        throw new BadRequestException(
          'Failed to update target bag (maxQty condition failed)',
        );
      }
      rollback.incTargetBag = true;

      // 2) increment item openingStock
      const itemRes = await this.itemModel.updateOne(
        { _id: job.itemId },
        { $inc: { openingStock: qty } },
      );
      if (itemRes.modifiedCount !== 1) {
        throw new BadRequestException('Failed to update item openingStock');
      }
      rollback.incItem = true;

      // 3) update job per-source and totals using arrayFilters
      const jobRes = await this.jobModel.updateOne(
        { _id: job._id, status: { $ne: 'completed' } },
        {
          $inc: {
            totalTransferQtyInWt: qty,
            'inputBags.$[src].transferQtyInWt': qty,
          },
        },
        { arrayFilters: [{ 'src.bagId': sourceBagId }] },
      );

      if (jobRes.modifiedCount !== 1) {
        throw new BadRequestException(
          'Failed to update job transfer quantities',
        );
      }
      rollback.incJob = true;

      // reload job to decide completion
      const updatedJob = await this.jobModel.findById(job._id);
      if (!updatedJob)
        throw new NotFoundException('Job not found after update');

      const newTotalTransferred = Number(updatedJob.totalTransferQtyInWt) || 0;
      const newRemainingOverall =
        (Number(updatedJob.totalInputQtyInWt) || 0) - newTotalTransferred;

      if (newRemainingOverall <= 0) {
        updatedJob.status = 'completed';
        updatedJob.completedAt = new Date();
        await updatedJob.save();
      }

      return {
        status: true,
        msg: 'Transferred to target bag successfully',
        data: updatedJob,
      };
    } catch (e) {
      // rollback best effort
      try {
        if (rollback.incJob) {
          await this.jobModel.updateOne(
            { _id: job._id },
            {
              $inc: {
                totalTransferQtyInWt: -qty,
                'inputBags.$[src].transferQtyInWt': -qty,
              },
            },
            { arrayFilters: [{ 'src.bagId': sourceBagId }] },
          );
        }
        if (rollback.incItem) {
          await this.itemModel.updateOne(
            { _id: job.itemId },
            { $inc: { openingStock: -qty } },
          );
        }
        if (rollback.incTargetBag) {
          await this.bagModel.updateOne(
            { _id: targetBagId },
            { $inc: { itemStock: -qty } },
          );
        }
      } catch (_) {}

      throw e;
    }
  }
}
