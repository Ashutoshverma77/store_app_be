import { Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { InjectModel } from '@nestjs/mongoose';
import { StoreItem } from '../store-item/schema/store-item.schema';
import { Model } from 'mongoose';
import { StorePlace } from '../store-place/schema/store-place.schema';
import { Receiving } from '../item-receive/schema/item-receive.schema';
import { Issue } from '../item-issue/schema/item-issue.schema';
import { StockMovement } from '../item-receive/schema/stock-movement.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(StoreItem.name, 'store')
    private readonly item: Model<StoreItem>,
    @InjectModel(StorePlace.name, 'store')
    private readonly place: Model<StorePlace>,
    @InjectModel(Receiving.name, 'store')
    private readonly rec: Model<Receiving>,
    @InjectModel(Issue.name, 'store') private readonly iss: Model<Issue>,
    @InjectModel(StockMovement.name, 'store')
    private readonly mov: Model<StockMovement>,
  ) {}

  async kpis(today: Date = new Date()) {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    const [items, places, openRec, openIss, sohAgg, recTodayAgg, issTodayAgg] =
      await Promise.all([
        this.item.countDocuments(),
        this.place.countDocuments(),
        this.rec.countDocuments({ status: { $in: ['DRAFT', 'APPROVED'] } }),
        this.iss.countDocuments({ status: { $in: ['DRAFT', 'APPROVED'] } }),
        this.item.aggregate([
          { $group: { _id: null, soh: { $sum: '$stockAvailableQuantity' } } },
        ]),
        this.mov.aggregate([
          {
            $match: { type: 'RECEIVE', createdAt: { $gte: start, $lte: end } },
          },
          { $group: { _id: null, qty: { $sum: '$qty' } } },
        ]),
        this.mov.aggregate([
          { $match: { type: 'ISSUE', createdAt: { $gte: start, $lte: end } } },
          { $group: { _id: null, qty: { $sum: '$qty' } } },
        ]),
      ]);

    return {
      totalItems: items,
      totalPlaces: places,
      openReceivings: openRec,
      openIssues: openIss,
      stockOnHand: sohAgg[0]?.soh ?? 0,
      todayReceived: recTodayAgg[0]?.qty ?? 0,
      todayIssued: issTodayAgg[0]?.qty ?? 0,
    };
  }

  async movementsTrend(from: Date, to: Date) {
    return this.mov.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          type: { $in: ['RECEIVE', 'ISSUE', 'SCRAP'] },
        },
      },
      {
        $project: {
          day: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d' } },
          type: 1,
          qty: 1,
        },
      },
      {
        $group: {
          _id: { day: '$day', type: '$type' },
          qty: { $sum: '$qty' },
        },
      },
      {
        $group: {
          _id: '$_id.day',
          receive: {
            $sum: { $cond: [{ $eq: ['$_id.type', 'RECEIVE'] }, '$qty', 0] },
          },
          issue: {
            $sum: { $cond: [{ $eq: ['$_id.type', 'ISSUE'] }, '$qty', 0] },
          },
          scrap: {
            $sum: { $cond: [{ $eq: ['$_id.type', 'SCRAP'] }, '$qty', 0] },
          },
        },
      },
      { $project: { _id: 0, day: '$_id', receive: 1, issue: 1, scrap: 1 } },
      { $sort: { day: 1 } },
    ]);
  }

  async topItems(from: Date, to: Date, type: 'ISSUE' | 'RECEIVE', limit = 10) {
    return this.mov.aggregate([
      { $match: { type, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$itemId', qty: { $sum: '$qty' } } },
      { $sort: { qty: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'storeitems',
          localField: '_id',
          foreignField: '_id',
          as: 'item',
        },
      },
      { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          itemId: '$_id',
          qty: 1,
          name: '$item.name',
          unit: '$item.unit',
          _id: 0,
        },
      },
    ]);
  }

  async receivingStatus() {
    return this.rec.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]);
  }

  async issueStatus() {
    return this.iss.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]);
  }

  async placeUtilization() {
    return this.place.aggregate([
      {
        $lookup: {
          from: 'storeplaceitemquantities',
          localField: 'StorePlaceItemQuantityIds',
          foreignField: '_id',
          as: 'rows',
        },
      },
      {
        $project: {
          name: 1,
          code: 1,
          totalQty: {
            $sum: {
              $map: {
                input: '$rows',
                as: 'r',
                in: { $toDouble: '$$r.totalQuantity' },
              },
            },
          },
          issuedQty: {
            $sum: {
              $map: {
                input: '$rows',
                as: 'r',
                in: { $toDouble: '$$r.IssuedQuantity' },
              },
            },
          },
        },
      },
      { $addFields: { available: { $subtract: ['$totalQty', '$issuedQty'] } } },
      { $sort: { available: -1 } },
    ]);
  }

  async itemLocations(itemId: string) {
    return this.place.aggregate([
      {
        $lookup: {
          from: 'storeplaceitemquantities',
          localField: 'StorePlaceItemQuantityIds',
          foreignField: '_id',
          as: 'rows',
        },
      },
      { $unwind: '$rows' },
      { $match: { 'rows.itemId': itemId } },
      {
        $project: {
          placeId: '$_id',
          placeName: '$name',
          code: '$code',
          totalQuantity: { $toDouble: '$rows.totalQuantity' },
          issuedQuantity: { $toDouble: '$rows.IssuedQuantity' },
          available: {
            $subtract: [
              { $toDouble: '$rows.totalQuantity' },
              { $toDouble: '$rows.IssuedQuantity' },
            ],
          },
        },
      },
      { $sort: { available: -1 } },
    ]);
  }

  // src/analytics/analytics.service.ts
  async itemMovements(from: Date, to: Date) {
    return this.mov.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          type: { $in: ['RECEIVE', 'ISSUE'] },
        },
      },
      {
        $lookup: {
          from: 'storeitems',
          localField: 'itemId',
          foreignField: '_id',
          as: 'item',
        },
      },
      { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'storeplaces',
          localField: 'placeId',
          foreignField: '_id',
          as: 'place',
        },
      },
      { $unwind: { path: '$place', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          itemName: '$item.name',
          placeName: '$place.name',
          qty: 1,
          type: 1,
          note: 1,
          createdAt: 1,
          refNo: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  }

  // src/analytics/analytics.service.ts
  // import { Types } from 'mongoose';

  // -------- CATEGORY STOCK SNAPSHOT --------
  // analytics.service.ts
  async categoryStock() {
    const items = await this.item.aggregate([
      {
        $group: {
          _id: '$category',
          available: { $sum: '$stockAvailableQuantity' },
          issued: { $sum: '$stockIssueQuantity' },
          scrap: { $sum: '$stockscrapQuantity' },
          total: { $sum: '$totalStockQuantity' },
        },
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          available: 1,
          issued: 1,
          scrap: 1,
          total: 1,
        },
      },
    ]);
    return items;
  }

  // -------- CATEGORY MOVEMENT TREND (by day) --------
  async categoryTrend(from: Date, to: Date) {
    return this.mov.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          type: { $in: ['RECEIVE', 'ISSUE', 'SCRAP'] },
        },
      },
      {
        $lookup: {
          from: 'storeitems',
          localField: 'itemId',
          foreignField: '_id',
          as: 'item',
        },
      },
      { $unwind: '$item' },
      {
        $project: {
          category: '$item.category',
          qty: 1,
          type: 1,
          createdAt: 1,
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            category: '$category',
            type: '$type',
          },
          totalQty: { $sum: '$qty' },
        },
      },
      {
        $group: {
          _id: { date: '$_id.date', category: '$_id.category' },
          movements: {
            $push: { type: '$_id.type', qty: '$totalQty' },
          },
        },
      },
      { $sort: { '_id.date': 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          category: '$_id.category',
          movements: 1,
        },
      },
    ]);
  }

  // -------- USER / OPERATOR ACTIVITY --------
  async userActivity(from: Date, to: Date, limit = 10) {
    return this.mov.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$operatedBy',
          ops: { $sum: 1 },
          receiveQty: {
            $sum: { $cond: [{ $eq: ['$type', 'RECEIVE'] }, '$qty', 0] },
          },
          issueQty: {
            $sum: { $cond: [{ $eq: ['$type', 'ISSUE'] }, '$qty', 0] },
          },
        },
      },
      { $sort: { ops: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: '$user.name',
          email: '$user.email',
          ops: 1,
          receiveQty: 1,
          issueQty: 1,
        },
      },
    ]);
  }

  // -------- LOW STOCK ITEMS --------
  async lowStock(threshold = 10) {
    return this.item.aggregate([
      { $match: { stockAvailableQuantity: { $lt: threshold } } },
      {
        $project: {
          _id: 1,
          name: 1,
          category: 1,
          available: '$stockAvailableQuantity',
          unit: 1,
        },
      },
      { $sort: { available: 1 } },
    ]);
  }

  // -------- DEAD STOCK (no issue in last N days) --------
  async deadStock(days = 60) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    return this.item.aggregate([
      {
        $lookup: {
          from: 'stockmovements',
          let: { id: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$itemId', '$$id'] },
                    { $eq: ['$type', 'ISSUE'] },
                    { $gte: ['$createdAt', since] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'recentIssues',
        },
      },
      { $match: { recentIssues: { $size: 0 } } },
      {
        $project: {
          _id: 1,
          name: 1,
          category: 1,
          available: '$stockAvailableQuantity',
          unit: 1,
        },
      },
      { $sort: { available: -1 } },
    ]);
  }

  // -------- PLACE "HEATMAP" SNAPSHOT (ratio) --------
  async placeHeatmap() {
    return this.place.aggregate([
      {
        $lookup: {
          from: 'storeplaceitemquantities',
          localField: 'StorePlaceItemQuantityIds',
          foreignField: '_id',
          as: 'rows',
        },
      },
      {
        $project: {
          name: 1,
          code: 1,
          total: {
            $sum: {
              $map: {
                input: '$rows',
                as: 'r',
                in: { $toDouble: '$$r.totalQuantity' },
              },
            },
          },
          issued: {
            $sum: {
              $map: {
                input: '$rows',
                as: 'r',
                in: { $toDouble: '$$r.IssuedQuantity' },
              },
            },
          },
        },
      },
      {
        $addFields: {
          available: { $subtract: ['$total', '$issued'] },
          usagePct: {
            $cond: [
              { $gt: ['$total', 0] },
              { $divide: ['$issued', '$total'] },
              0,
            ],
          },
        },
      },
      {
        $project: {
          name: 1,
          code: 1,
          available: 1,
          total: 1,
          issued: 1,
          usagePct: 1,
        },
      },
      { $sort: { usagePct: -1 } },
    ]);
  }

  // -------- THROUGHPUT (avg hours) --------
  // async throughput(kind: 'receiving' | 'issue', from: Date, to: Date) {
  //   const col = kind === 'receiving' ? this.rec : this.iss;
  //   return col.aggregate([
  //     {
  //       $match: {
  //         approvedAt: { $ne: null },
  //         // closedAt: { $ne: null },
  //         closedAt: { $gte: from, $lte: to },
  //       },
  //     },
  //     {
  //       $project: {
  //         hours: {
  //           $divide: [
  //             { $subtract: ['$closedAt', '$approvedAt'] },
  //             1000 * 60 * 60,
  //           ],
  //         },
  //       },
  //     },
  //     { $group: { _id: null, avgHours: { $avg: '$hours' } } },
  //   ]);
  // }
  // analytics.service.ts
  async throughput(kind: 'receiving' | 'issue', from: Date, to: Date) {
    const col = kind === 'receiving' ? this.rec : this.iss;
    const res = await col.aggregate([
      {
        $match: {
          $and: [
            { approvedAt: { $ne: null } },
            { closedAt: { $ne: null } },
            { closedAt: { $gte: from, $lte: to } },
          ],
        },
      },
      {
        $project: {
          hours: {
            $divide: [
              { $subtract: ['$closedAt', '$approvedAt'] },
              1000 * 60 * 60,
            ],
          },
        },
      },
      { $group: { _id: null, avgHours: { $avg: '$hours' } } },
    ]);

    // Return a single object instead of an array
    return { avgHours: res[0]?.avgHours ?? 0 };
  }

  // Return minimal list of items for dropdowns/search
  async itemsMin() {
    return this.item.find({}, { name: 1, unit: 1 }).sort({ name: 1 }).lean();
  }
}
