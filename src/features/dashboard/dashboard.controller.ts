import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';

@Controller('api/analytics')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  getKpis() {
    return this.dashboardService.kpis();
  }

  @Get('movements-trend')
  trend(@Query('from') f: string, @Query('to') t: string) {
    return this.dashboardService.movementsTrend(new Date(f), new Date(t));
  }

  @Get('top-items')
  top(
    @Query('from') f: string,
    @Query('to') t: string,
    @Query('type') type: 'ISSUE' | 'RECEIVE',
    @Query('limit') limit = '10',
  ) {
    return this.dashboardService.topItems(
      new Date(f),
      new Date(t),
      type,
      Number(limit),
    );
  }

  @Get('receiving-status')
  recStatus() {
    return this.dashboardService.receivingStatus();
  }

  @Get('issue-status')
  issStatus() {
    return this.dashboardService.issueStatus();
  }

  @Get('place-utilization')
  placeUtil() {
    return this.dashboardService.placeUtilization();
  }

  @Get('item-locations/:itemId')
  itemLoc(@Param('itemId') id: string) {
    return this.dashboardService.itemLocations(id);
  }

  // src/analytics/analytics.controller.ts
  @Get('item-movements')
  getMovements(@Query('from') f: string, @Query('to') t: string) {
    return this.dashboardService.itemMovements(new Date(f), new Date(t));
  }

  // src/analytics/analytics.controller.ts
  @Get('category-stock') categoryStock() {
    return this.dashboardService.categoryStock();
  }

  @Get('category-trend')
  categoryTrend(@Query('from') f: string, @Query('to') t: string) {
    return this.dashboardService.categoryTrend(new Date(f), new Date(t));
  }

  @Get('user-activity')
  userAct(
    @Query('from') f: string,
    @Query('to') t: string,
    @Query('limit') lim = '10',
  ) {
    return this.dashboardService.userActivity(
      new Date(f),
      new Date(t),
      Number(lim),
    );
  }

  @Get('low-stock')
  low(@Query('threshold') th = '10') {
    return this.dashboardService.lowStock(Number(th));
  }

  @Get('dead-stock')
  dead(@Query('days') d = '60') {
    return this.dashboardService.deadStock(Number(d));
  }

  @Get('place-heatmap')
  heat() {
    return this.dashboardService.placeHeatmap();
  }

  @Get('throughput')
  getThroughput(
    @Query('kind') kind: 'receiving' | 'issue',
    @Query('from') f: string,
    @Query('to') t: string,
  ) {
    return this.dashboardService.throughput(kind, new Date(f), new Date(t));
  }
  @Get('items-min')
  itemsMin() {
    return this.dashboardService.itemsMin();
  }
}
