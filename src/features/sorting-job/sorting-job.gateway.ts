// src/sorting-jobs/sorting-jobs.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { SortingJobsService } from './sorting-job.service';

@WebSocketGateway({ cors: { origin: '*', credentials: true } })
export class SortingJobsGateway {
  @WebSocketServer() server!: Server;

  constructor(private readonly service: SortingJobsService) {}

  @SubscribeMessage('sortingJob:findAllSortingJob')
  async onFindAll(@MessageBody() _data: any) {
    const jobs = await this.service.findAll();
    this.server.emit('sortingJob:findAllSortingJob', jobs);
  }

  async emitAllJobs() {
    const jobs = await this.service.findAll();
    this.server.emit('sortingJob:findAllSortingJob', jobs);
  }

  async emitAllJobsMachine() {
    const jobs = await this.service.findAllMachine();
    this.server.emit('sortingJob:findAllSortingJobMachine', jobs);
  }

  @SubscribeMessage('sortingJob:findAllSortingJobMachine')
  async onFindAllMachine(@MessageBody() _data: any) {
    const jobs = await this.service.findAllMachine();
    this.server.emit('sortingJob:findAllSortingJobMachine', jobs);
  }
}
