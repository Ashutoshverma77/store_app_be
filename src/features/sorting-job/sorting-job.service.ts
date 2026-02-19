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
import {
  ActivityLogsService,
  ActivityActorInput,
} from '../activity/activity.service';
import { AddBagToJobDto } from './dto/add-bag-to-job.dto';
import { TransferToBagTwoDto } from './dto/transfer-to-bag-two.dto';
import { Machine, MachineDocument } from './entities/machine.schema';
import { CreateMachineDto } from './dto/create-machine.dto';
import { StoreCategory } from '../new-store/store-items/store-category/entities/store-category.schema';
import { StoreNewItem } from '../new-store/store-items/store-item/entities/store-item.schema';

@Injectable()
export class SortingJobsService {
  constructor(
    @InjectModel(SortingJob.name, 'store')
    private jobModel: Model<SortingJobDocument>,
    @InjectModel(Bag.name, 'store') private bagModel: Model<BagDocument>,
    @InjectModel(Item.name, 'store') private itemModel: Model<ItemDocument>,
    @InjectModel(Machine.name, 'store')
    private readonly machineModel: Model<MachineDocument>,

    @InjectModel('StoreNewItem', 'store')
    private readonly itemNewModel: Model<StoreNewItem>,

    @InjectModel('StoreCategory', 'store')
    private readonly catModel: Model<StoreCategory>,
    private readonly activity: ActivityLogsService,
  ) {}

  // ----------------- helpers -----------------
  private toId(v: any): string | null {
    if (!v) return null;
    try {
      return v.toString();
    } catch {
      return null;
    }
  }

  private bagSnap(b: any) {
    if (!b) return null;
    return {
      id: this.toId(b._id),
      bagCode: b.bagCode,
      itemId: this.toId(b.itemId),
      itemName: b.itemName,
      itemStock: Number(b.itemStock) || 0,
      itemUsed: Number(b.itemUsed) || 0,
      maxQty: b.maxQty != null ? Number(b.maxQty) : null,
      transferQty: b.transferQty != null ? Number(b.transferQty) : 0,
      transferType: b.transferType ?? null,
    };
  }

  private itemSnap(i: any) {
    if (!i) return null;
    return {
      id: this.toId(i._id),
      code: i.code,
      name: i.name,
      openingStock: Number(i.openingStock) || 0,
      unit: i.unit ?? null,
    };
  }

  private jobSnap(j: any) {
    if (!j) return null;
    return {
      id: this.toId(j._id),
      itemId: this.toId(j.itemId),
      itemName: j.itemName,
      machineName: j.machineName ?? null,
      status: j.status,
      totalInputQtyInBags: Number(j.totalInputQtyInBags) || 0,
      totalInputQtyInWt: Number(j.totalInputQtyInWt) || 0,
      totalTransferQtyInWt: Number(j.totalTransferQtyInWt) || 0,
      inputBags:
        (j.inputBags ?? []).map((x: any) => ({
          bagId: this.toId(x.bagId),
          bagCode: x.bagCode,
          qtyInWt: Number(x.qtyInWt) || 0,
          transferQtyInWt: Number(x.transferQtyInWt) || 0,
        })) ?? [],
      startedAt: j.startedAt ?? null,
      completedAt: j.completedAt ?? null,
    };
  }

  // ----------------- queries -----------------
  async findAll() {
    return this.jobModel.find().sort({ createdAt: -1 }).lean();
  }

  async findAllMachine() {
    return this.machineModel.find({ isActive: true }).lean();
  }

  async findById(id: string) {
    const job = await this.jobModel.findById(id).lean();
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  // ----------------- CREATE -----------------
  // CREATE JOB: subtract from bag stock and item opening stock
  async create(dto: CreateSortingJobDto, actor?: ActivityActorInput) {
    console.log(dto);

    const itemId = new Types.ObjectId(dto.itemId);
    const machineId = new Types.ObjectId(dto.machineId);

    const machineBefore = await this.machineModel.findById(machineId);
    if (!machineBefore) throw new NotFoundException('machine not found');
    if (!machineBefore.isActive)
      throw new NotFoundException('machine not active');

    const itemBefore = await this.itemModel.findById(itemId);
    if (!itemBefore) throw new NotFoundException('Item not found');

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

    if ((itemBefore.openingStock ?? 0) < totalInputQtyInWt) {
      throw new BadRequestException(
        `Item opening stock insufficient. Need ${totalInputQtyInWt}, have ${itemBefore.openingStock}`,
      );
    }

    const itemBeforeSnap = this.itemSnap(itemBefore);

    // track per-bag before/after for activity
    const bagChanges: Array<{
      bagId: string;
      bagCode: string;
      before: any;
      after: any;
      qtyInWt: number;
    }> = [];

    // Apply bag updates (stock - , used +)
    for (const b of dto.inputBags) {
      const qty = Number(b.qtyInWt) || 0;
      if (qty <= 0) throw new BadRequestException('qtyInWt must be > 0');

      // locate bag by id primarily; fallback by code (optional)
      const bagDoc = b.bagId
        ? await this.bagModel.findById(b.bagId)
        : await this.bagModel.findOne({ bagCode: b.bagCode });

      if (!bagDoc) throw new NotFoundException(`Bag not found: ${b.bagCode}`);
      if (bagDoc.itemId.toString() !== itemId.toString()) {
        throw new BadRequestException(
          `Bag ${bagDoc.bagCode} does not belong to selected item`,
        );
      }

      if ((bagDoc.itemStock ?? 0) < qty) {
        throw new BadRequestException(
          `Bag ${bagDoc.bagCode} has insufficient stock. Need ${qty}, have ${bagDoc.itemStock}`,
        );
      }

      const before = this.bagSnap(bagDoc);

      bagDoc.itemStock = (bagDoc.itemStock ?? 0) - qty;
      bagDoc.itemUsed = (bagDoc.itemUsed ?? 0) + qty;
      await bagDoc.save();

      const after = this.bagSnap(bagDoc);

      bagChanges.push({
        bagId: bagDoc._id!.toString(),
        bagCode: bagDoc.bagCode,
        before,
        after,
        qtyInWt: qty,
      });
    }

    // Update item opening stock
    itemBefore.openingStock =
      (itemBefore.openingStock ?? 0) - totalInputQtyInWt;
    await itemBefore.save();
    const itemAfterSnap = this.itemSnap(itemBefore);

    // Create job
    const created = await this.jobModel.create({
      machineId: dto.machineId,
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

    // -------- activity log --------
    await this.activity.log({
      module: 'sorting_jobs',
      action: 'create',
      eventKey: 'sorting_jobs.create',
      actor: dto.createdBy
        ? { userId: dto.createdBy } // ✅ from Flutter uid
        : actor,
      entities: [
        {
          type: 'SortingJob',
          id: created._id!.toString(),
          label: created.itemName,
        },
        {
          type: 'Item',
          id: itemId.toString(),
          label: itemAfterSnap?.name ?? created.itemName,
        },
        ...bagChanges.map((x) => ({
          type: 'Bag',
          id: x.bagId,
          label: x.bagCode,
        })),
      ],
      changes: {
        before: {
          item: itemBeforeSnap,
          bags: bagChanges.map((x) => x.before),
          job: null,
        },
        after: {
          item: itemAfterSnap,
          bags: bagChanges.map((x) => x.after),
          job: this.jobSnap(created),
        },
        delta: {
          itemOpeningStock: -(totalInputQtyInWt || 0),
          totalInputQtyInBags: dto.inputBags.length,
          totalInputQtyInWt,
        },
      },
      meta: {
        machineName: dto.machineName ?? null,
        inputBags: dto.inputBags,
      },
    });

    return { status: true, msg: 'Sorting job created', data: created };
  }

  // ----------------- START -----------------
  async start(id: string, createdBy?: string, actor?: ActivityActorInput) {
    const jobBefore = await this.jobModel.findById(id);
    if (!jobBefore) throw new NotFoundException('Job not found');
    if (jobBefore.status === 'completed')
      throw new BadRequestException('Job already completed');

    const beforeSnap = this.jobSnap(jobBefore);

    jobBefore.status = 'started';
    jobBefore.startedAt = new Date();
    await jobBefore.save();

    const afterSnap = this.jobSnap(jobBefore);

    await this.activity.log({
      module: 'sorting_jobs',
      action: 'start',
      eventKey: 'sorting_jobs.start',
      actor: createdBy
        ? { userId: createdBy } // ✅ from Flutter uid
        : actor,
      entities: [
        {
          type: 'SortingJob',
          id: jobBefore._id!.toString(),
          label: jobBefore.itemName,
        },
        {
          type: 'Item',
          id: jobBefore.itemId.toString(),
          label: jobBefore.itemName,
        },
      ],
      changes: {
        before: { job: beforeSnap },
        after: { job: afterSnap },
        delta: { status: 'started' },
      },
      meta: {},
    });

    return jobBefore;
  }

  // ----------------- TRANSFER ONE (return to same bag) -----------------
  async transferOne(
    id: string,
    dto: TransferSortingJobDto,
    actor?: ActivityActorInput,
  ) {
    const job = await this.jobModel.findById(id);
    if (!job) throw new NotFoundException('Job not found');
    if (job.status === 'completed')
      throw new BadRequestException('Job already completed');

    const transferWt = Number(dto.transferQtyInWt) || 0;
    if (transferWt <= 0) {
      throw new BadRequestException('transferQtyInWt must be > 0');
    }

    const jobBeforeSnap = this.jobSnap(job);

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

    // bag doc
    const bagDoc = inputBag.bagId
      ? await this.bagModel.findById(inputBag.bagId)
      : await this.bagModel.findOne({ bagCode: inputBag.bagCode });

    if (!bagDoc) throw new NotFoundException('Target bag not found');
    const bagBeforeSnap = this.bagSnap(bagDoc);

    // item doc
    const item = await this.itemModel.findById(job.itemId);
    if (!item) throw new NotFoundException('Item not found');
    const itemBeforeSnap = this.itemSnap(item);

    // apply bag (stock +, used -)
    bagDoc.itemStock = (bagDoc.itemStock ?? 0) + transferWt;
    bagDoc.itemUsed = Math.max(0, (bagDoc.itemUsed ?? 0) - transferWt);
    await bagDoc.save();
    const bagAfterSnap = this.bagSnap(bagDoc);

    // apply item (openingStock +)
    item.openingStock = (item.openingStock ?? 0) + transferWt;
    await item.save();
    const itemAfterSnap = this.itemSnap(item);

    // apply job (per-bag transfer and total)
    inputBag.transferQtyInWt =
      (Number(inputBag.transferQtyInWt) || 0) + transferWt;
    job.totalTransferQtyInWt = alreadyTransferredWt + transferWt;

    // mark completed when fully transferred
    if (job.totalTransferQtyInWt === job.totalInputQtyInWt) {
      job.status = 'completed';
      job.completedAt = new Date();
    } else {
      if (job.status === 'created') job.status = 'started';
    }

    await job.save();
    const jobAfterSnap = this.jobSnap(job);

    // activity
    await this.activity.log({
      module: 'sorting_jobs',
      action: 'transfer',
      eventKey: 'sorting_jobs.transfer_one',
      actor: dto.createdBy
        ? { userId: dto.createdBy } // ✅ from Flutter uid
        : actor,
      entities: [
        { type: 'SortingJob', id: job._id!.toString(), label: job.itemName },
        { type: 'Bag', id: bagDoc._id!.toString(), label: bagDoc.bagCode },
        { type: 'Item', id: job.itemId.toString(), label: job.itemName },
      ],
      changes: {
        before: {
          job: jobBeforeSnap,
          bag: bagBeforeSnap,
          item: itemBeforeSnap,
        },
        after: { job: jobAfterSnap, bag: bagAfterSnap, item: itemAfterSnap },
        delta: {
          transferQtyInWt: transferWt,
          jobTotalTransferQtyInWt: transferWt,
          itemOpeningStock: transferWt,
          bagItemStock: transferWt,
          bagItemUsed: -transferWt,
        },
      },
      meta: {
        bagCode: inputBag.bagCode,
        bagId: inputBag.bagId ? inputBag.bagId.toString() : null,
      },
    });

    return { status: true, msg: 'Sorting job Qty Transfered', data: job };
  }

  // ----------------- TRANSFER TO ANOTHER BAG -----------------
  async transferToAnotherBag(
    jobId: string,
    dto: TransferToBagDto,
    actor?: ActivityActorInput,
  ) {
    const job = await this.jobModel.findById(jobId);
    if (!job) throw new NotFoundException('Job not found');
    if (job.status === 'completed')
      throw new BadRequestException('Job already completed');

    const jobBeforeSnap = this.jobSnap(job);

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

    // Load target bag
    const targetBag = await this.bagModel.findById(targetBagId);
    if (!targetBag) throw new NotFoundException('Target bag not found');
    const targetBeforeSnap = this.bagSnap(targetBag);

    if (targetBag.itemId.toString() !== job.itemId.toString()) {
      throw new BadRequestException('Target bag itemId mismatch');
    }

    const maxQty = Number(targetBag.maxQty) || 0;
    if (maxQty <= 0) {
      throw new BadRequestException(
        `Target bag maxQty not set for ${targetBag.bagCode}`,
      );
    }

    const targetCurrent = Number(targetBag.itemStock) || 0;
    if (targetCurrent + qty > maxQty) {
      throw new BadRequestException(
        `Target bag exceeds maxQty. maxQty=${maxQty}, current=${targetCurrent}, add=${qty}`,
      );
    }

    const itemBefore = await this.itemModel.findById(job.itemId);
    if (!itemBefore) throw new NotFoundException('Item not found');
    const itemBeforeSnap = this.itemSnap(itemBefore);

    // rollback best-effort
    const rollback = {
      incTargetBag: false,
      incItem: false,
      incJob: false,
    };

    try {
      // 1) increment target bag with maxQty guard
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

      const targetAfter = await this.bagModel.findById(targetBagId).lean();
      const itemAfter = await this.itemModel.findById(job.itemId).lean();

      await this.activity.log({
        module: 'sorting_jobs',
        action: 'transfer',
        eventKey: 'sorting_jobs.transfer_to_bag',
        actor: dto.createdBy
          ? { userId: dto.createdBy } // ✅ from Flutter uid
          : actor,
        entities: [
          {
            type: 'SortingJob',
            id: updatedJob._id!.toString(),
            label: updatedJob.itemName,
          },
          {
            type: 'Bag',
            id: targetBagId.toString(),
            label: targetBeforeSnap?.bagCode ?? 'target',
          },
          {
            type: 'Bag',
            id: sourceBagId.toString(),
            label: inputRow.bagCode ?? 'source',
          },
          {
            type: 'Item',
            id: updatedJob.itemId.toString(),
            label: updatedJob.itemName,
          },
        ],
        changes: {
          before: {
            job: jobBeforeSnap,
            item: itemBeforeSnap,
            targetBag: targetBeforeSnap,
          },
          after: {
            job: this.jobSnap(updatedJob),
            item: this.itemSnap(itemAfter),
            targetBag: this.bagSnap(targetAfter),
          },
          delta: {
            transferQtyInWt: qty,
            jobTotalTransferQtyInWt: qty,
            itemOpeningStock: qty,
            targetBagItemStock: qty,
          },
        },
        meta: {
          sourceBagId: sourceBagId.toString(),
          targetBagId: targetBagId.toString(),
        },
      });

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

  async transferToAnotherBagTwo(
    jobId: string,
    dto: TransferToBagTwoDto,
    actor?: ActivityActorInput,
  ) {
    const job = await this.jobModel.findById(jobId);
    if (!job) throw new NotFoundException('Job not found');
    if (job.status === 'completed') {
      throw new BadRequestException('Job already completed');
    }

    const jobBeforeSnap = this.jobSnap(job);

    const targetBagId = new Types.ObjectId(dto.targetBagId);

    const qty = Number(dto.transferQtyInWt) || 0;
    if (qty <= 0) throw new BadRequestException('transferQtyInWt must be > 0');

    // ---- Validate target bag ----
    const targetBag = await this.bagModel.findById(targetBagId);
    if (!targetBag) throw new NotFoundException('Target bag not found');
    const targetBeforeSnap = this.bagSnap(targetBag);

    // 1) itemId must match
    if (targetBag.itemId.toString() !== job.itemId.toString()) {
      throw new BadRequestException('Target bag itemId mismatch');
    }

    // 2) maxQty guard
    const maxQty = Number(targetBag.maxQty) || 0;
    if (maxQty <= 0) {
      throw new BadRequestException(
        `Target bag maxQty not set for ${targetBag.bagCode}`,
      );
    }

    const targetCurrent = Number(targetBag.itemStock) || 0;
    const targetCapacityRemaining = maxQty - targetCurrent;
    if (targetCapacityRemaining < 0) {
      throw new BadRequestException(
        'Target bag data corrupted: stock > maxQty',
      );
    }
    if (qty > targetCapacityRemaining) {
      throw new BadRequestException(
        `Target bag exceeds maxQty. CapacityRemaining=${targetCapacityRemaining}, requested=${qty}`,
      );
    }

    // ---- Validate job remaining overall ----
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

    // ---- Auto-allocate transfer qty across inputBags ----
    // We take from job.inputBags in order and consume each bag's remaining.
    const allocations: Array<{
      bagId: Types.ObjectId;
      bagCode: string;
      qty: number;
    }> = [];

    let toAllocate = qty;
    const inputBags = job.inputBags || [];

    for (const row of inputBags as any[]) {
      if (toAllocate <= 0) break;

      const rowQty = Number(row.qtyInWt) || 0;
      const rowTransferred = Number(row.transferQtyInWt) || 0;
      const rowRemaining = rowQty - rowTransferred;

      if (rowRemaining <= 0) continue;

      const take = Math.min(rowRemaining, toAllocate);

      if (!row.bagId) {
        // You said bagId is present in job inputBags. If not, you cannot update row safely.
        throw new BadRequestException(
          'Job inputBags contains row without bagId',
        );
      }

      allocations.push({
        bagId: new Types.ObjectId(row.bagId),
        bagCode: row.bagCode,
        qty: take,
      });

      toAllocate -= take;
    }

    if (toAllocate > 0) {
      // Should never happen because we already checked remainingOverall, but keep hard guard.
      throw new BadRequestException(
        `Unable to allocate full qty across input bags. Unallocated=${toAllocate}`,
      );
    }

    const itemBefore = await this.itemModel.findById(job.itemId);
    if (!itemBefore) throw new NotFoundException('Item not found');
    const itemBeforeSnap = this.itemSnap(itemBefore);

    // Rollback flags
    const rollback = {
      incTargetBag: false,
      incItem: false,
      jobIncs: [] as Array<{ bagId: Types.ObjectId; qty: number }>,
      incJobTotal: false,
    };

    try {
      // 1) increment target bag with maxQty guard (atomic condition)
      const bagRes = await this.bagModel.updateOne(
        { _id: targetBagId, itemStock: { $lte: maxQty - qty } },
        { $inc: { itemStock: qty }, $set: { transferType: 'inStock' } },
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

      // 3) increment job totals
      const jobTotalRes = await this.jobModel.updateOne(
        { _id: job._id, status: { $ne: 'completed' } },
        { $inc: { totalTransferQtyInWt: qty } },
      );
      if (jobTotalRes.modifiedCount !== 1) {
        throw new BadRequestException(
          'Failed to update job totalTransferQtyInWt',
        );
      }
      rollback.incJobTotal = true;

      // 4) increment per-inputBag transferQtyInWt for each allocation
      for (const a of allocations) {
        const r = await this.jobModel.updateOne(
          { _id: job._id },
          { $inc: { 'inputBags.$[src].transferQtyInWt': a.qty } },
          { arrayFilters: [{ 'src.bagId': a.bagId }] },
        );
        if (r.modifiedCount !== 1) {
          throw new BadRequestException(
            `Failed to update job inputBags transfer for bag ${a.bagCode}`,
          );
        }
        rollback.jobIncs.push({ bagId: a.bagId, qty: a.qty });
      }

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
      } else {
        if (updatedJob.status === 'created') updatedJob.status = 'started';
        await updatedJob.save();
      }

      const targetAfter = await this.bagModel.findById(targetBagId).lean();
      const itemAfter = await this.itemModel.findById(job.itemId).lean();

      await this.activity.log({
        module: 'sorting_jobs',
        action: 'transfer',
        eventKey: 'sorting_jobs.transfer_to_bag_auto_source',
        actor: dto.createdBy ? { userId: dto.createdBy } : actor,
        entities: [
          {
            type: 'SortingJob',
            id: updatedJob._id!.toString(),
            label: updatedJob.itemName,
          },
          {
            type: 'Bag',
            id: targetBagId.toString(),
            label: targetBeforeSnap?.bagCode ?? 'target',
          },
          {
            type: 'Item',
            id: updatedJob.itemId.toString(),
            label: updatedJob.itemName,
          },
        ],
        changes: {
          before: {
            job: jobBeforeSnap,
            item: itemBeforeSnap,
            targetBag: targetBeforeSnap,
          },
          after: {
            job: this.jobSnap(updatedJob),
            item: this.itemSnap(itemAfter),
            targetBag: this.bagSnap(targetAfter),
          },
          delta: {
            transferQtyInWt: qty,
            itemOpeningStock: qty,
            targetBagItemStock: qty,
            allocations, // ✅ shows which input bags consumed how much
          },
        },
        meta: {
          targetBagId: targetBagId.toString(),
        },
      });

      return {
        status: true,
        msg: 'Transferred to target bag successfully',
        data: updatedJob,
      };
    } catch (e) {
      // rollback best effort
      try {
        // rollback per-row increments
        for (const x of rollback.jobIncs) {
          await this.jobModel.updateOne(
            { _id: job._id },
            { $inc: { 'inputBags.$[src].transferQtyInWt': -x.qty } },
            { arrayFilters: [{ 'src.bagId': x.bagId }] },
          );
        }

        // rollback job total
        if (rollback.incJobTotal) {
          await this.jobModel.updateOne(
            { _id: job._id },
            { $inc: { totalTransferQtyInWt: -qty } },
          );
        }

        // rollback item
        if (rollback.incItem) {
          await this.itemModel.updateOne(
            { _id: job.itemId },
            { $inc: { openingStock: -qty } },
          );
        }

        // rollback target bag
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

  // inside SortingJobsService
  async findStartedJobsByItem(itemId: string) {
    const oid = new Types.ObjectId(itemId);
    return this.jobModel
      .find({ itemId: oid, status: { $in: ['started', 'restarted'] } })
      .sort({ createdAt: -1 })
      .lean();
  }
  /**
   * Adds ONE bag into an already started job:
   * - job must be started
   * - bag.itemId must match job.itemId
   * - bag must NOT already exist in job.inputBags
   * - qtyInWt <= bag.itemStock
   * Then:
   * - bag.itemStock -= qtyInWt, bag.itemUsed += qtyInWt
   * - item.openingStock -= qtyInWt
   * - job.inputBags.push({bagId, bagCode, qtyInWt, transferQtyInWt:0})
   * - job.totalInputQtyInBags += 1
   * - job.totalInputQtyInWt += qtyInWt
   */
  async addBagToJob(jobId: string, dto: AddBagToJobDto, userId?: string) {
    const job = await this.jobModel.findById(jobId);
    if (!job) throw new NotFoundException('Job not found');
    if (job.status === 'completed')
      throw new BadRequestException('Job already completed');

    // You said: only allow if started
    if (job.status !== 'started' && job.status !== 'restarted') {
      throw new BadRequestException('Job is not started');
    }

    const bagObjectId = new Types.ObjectId(dto.bagId);
    const qty = Number(dto.qtyInWt) || 0;
    if (qty <= 0) throw new BadRequestException('qtyInWt must be > 0');

    // ✅ Ensure bag not already present in job
    const already = (job.inputBags || []).some(
      (b: any) => b?.bagId?.toString() === dto.bagId,
    );
    if (already) {
      throw new BadRequestException('This bag is already added in this job');
    }

    const bag = await this.bagModel.findById(bagObjectId);
    if (!bag) throw new NotFoundException('Bag not found');

    if (bag.itemId.toString() !== job.itemId.toString()) {
      throw new BadRequestException('Bag itemId mismatch with job itemId');
    }

    if ((bag.itemStock ?? 0) < qty) {
      throw new BadRequestException(
        `Bag ${bag.bagCode} has insufficient stock. Need ${qty}, have ${bag.itemStock}`,
      );
    }

    const item = await this.itemModel.findById(job.itemId);
    if (!item) throw new NotFoundException('Item not found');

    if ((item.openingStock ?? 0) < qty) {
      throw new BadRequestException(
        `Item openingStock insufficient. Need ${qty}, have ${item.openingStock}`,
      );
    }

    // ---- best-effort rollback (no Mongo transactions) ----
    const rollback = {
      bagUpdated: false,
      itemUpdated: false,
      jobUpdated: false,
    };

    try {
      // 1) bag: stock -= qty, used += qty  (atomic condition)
      const bagRes = await this.bagModel.updateOne(
        { _id: bagObjectId, itemStock: { $gte: qty } },
        { $inc: { itemStock: -qty, itemUsed: qty } },
      );
      if (bagRes.modifiedCount !== 1) {
        throw new BadRequestException('Failed to update bag stock');
      }
      rollback.bagUpdated = true;

      // 2) item: openingStock -= qty (atomic condition)
      const itemRes = await this.itemModel.updateOne(
        { _id: job.itemId, openingStock: { $gte: qty } },
        { $inc: { openingStock: -qty } },
      );
      if (itemRes.modifiedCount !== 1) {
        throw new BadRequestException('Failed to update item openingStock');
      }
      rollback.itemUpdated = true;

      // 3) job: push new inputBags row + update totals
      // extra guard: do not push if already exists (race)
      const jobRes = await this.jobModel.updateOne(
        { _id: job._id, 'inputBags.bagId': { $ne: bagObjectId } },
        {
          $push: {
            inputBags: {
              bagId: bagObjectId,
              bagCode: bag.bagCode,
              qtyInWt: qty,
              transferQtyInWt: 0,
            },
          },
          $inc: {
            totalInputQtyInBags: 1,
            totalInputQtyInWt: qty,
          },
        },
      );

      if (jobRes.modifiedCount !== 1) {
        throw new BadRequestException(
          'Failed to add bag into job (maybe already exists)',
        );
      }
      rollback.jobUpdated = true;

      const updatedJob = await this.jobModel.findById(job._id).lean();

      // ✅ Activity log (pseudo)
      await this.activity.log({
        module: 'sorting_jobs',
        action: 'transferqr',
        eventKey: 'sorting_job.add_bag',
        actor: userId ? { userId } : {},
        entities: [
          { type: 'SortingJob', id: jobId, label: job.itemName },
          { type: 'Bag', id: dto.bagId, label: bag.bagCode },
          { type: 'Item', id: job.itemId.toString(), label: job.itemName },
        ],
        // changes: { qtyInWt: qty },
        meta: { bagCode: bag.bagCode },
      });

      return { status: true, msg: 'Bag added to job', data: updatedJob };
    } catch (e) {
      // rollback best effort
      try {
        if (rollback.jobUpdated) {
          await this.jobModel.updateOne(
            { _id: job._id },
            {
              $pull: { inputBags: { bagId: bagObjectId } },
              $inc: { totalInputQtyInBags: -1, totalInputQtyInWt: -qty },
            },
          );
        }
        if (rollback.itemUpdated) {
          await this.itemModel.updateOne(
            { _id: job.itemId },
            { $inc: { openingStock: qty } },
          );
        }
        if (rollback.bagUpdated) {
          await this.bagModel.updateOne(
            { _id: bagObjectId },
            { $inc: { itemStock: qty, itemUsed: -qty } },
          );
        }
      } catch (_) {}
      throw e;
    }
  }
  private twoLettersFromGroup(group: number): string {
    // AA..ZZ only
    const max = 26 * 26 - 1;
    if (group < 0 || group > max) {
      throw new Error('Code series exhausted (beyond ZZ).');
    }
    const first = Math.floor(group / 26);
    const second = group % 26;
    return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
  }
  private format(prefix: string, seq: number): string {
    const group = Math.floor((seq - 1) / 999); // 0 => AA, 1 => AB ...
    const num = ((seq - 1) % 999) + 1; // 1..999
    const letters = this.twoLettersFromGroup(group);
    const num3 = String(num).padStart(3, '0');
    return `${prefix}-${letters}${num3}`; // RM-AA001
  }

  async machineCreate(dto: CreateMachineDto) {
    // const categoryId = this.toObjectId(dto.categoryId, 'categoryId');
    // const itemId = dto.itemId ? this.toObjectId(dto.itemId, 'itemId') : null;

    // If you want to validate existence:
    const cat = await this.catModel.exists({ _id: dto.categoryId });
    if (!cat) throw new BadRequestException('Category not found');
    // if (itemId) {
    const it = await this.itemNewModel.exists({ _id: dto.itemId });
    if (!it) throw new BadRequestException('Item not found');
    // }
    const machine = await this.machineModel.exists({
      categoryId: dto.categoryId,
      itemId: dto.itemId,
    });
    if (machine) throw new BadRequestException('Item exists');
    // prevent duplicate code
    const exists = await this.machineModel.find();
    // if (exists) throw new BadRequestException('machineCode already exists');
    const categoryCode = this.format('MSJ', exists.length + 1);
    const created = await this.machineModel.create({
      machineCode: categoryCode,
      machineName: dto.machineName.trim(),
      categoryId: dto.categoryId,
      itemId: dto.itemId,
      remark: dto.remark ?? '',
      isActive: dto.isActive ?? true,
      createdBy: dto.createdBy ?? '',
    });

    return { status: true, msg: 'Machine created', data: created };
  }
}
