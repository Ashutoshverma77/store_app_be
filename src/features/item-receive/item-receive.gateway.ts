import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ReceivingService } from './item-receive.service';

@WebSocketGateway()
export class ItemReceiveGateway {
  @WebSocketServer() server: any;
  constructor(private readonly receivingService: ReceivingService) {}

  async broadcastAuthList() {
    const list = await this.receivingService.findPaged({
      page: 1,
      limit: 8,
      search: '',
      sort: '-createdAt',
    });
    this.server.emit('store:receiving:paged', list); // broadcast to all clients
  }

  @SubscribeMessage('store:findAllItemReceive')
  async findAll(client: any, payload: any) {
    var authUserList = await this.receivingService.findAll();

    client.emit('store:findAllItemReceive', authUserList);
    return;
  }

  @SubscribeMessage('store:receiving:paged')
  async findPagedReceivings(client: any, payload: any) {
    var authUserList = await this.receivingService.findPaged(payload);
    client.emit('store:receiving:paged', authUserList);
  }

  @SubscribeMessage('store:receivings:approve:paged')
  async receivingsApprovePaged(client: any, body: any) {
    var authUserList = await this.receivingService.findStatusPaged(body);
    client.emit('store:receivings:approve:paged', authUserList);
  }

  @SubscribeMessage('store:findStatusItemReceive')
  async findStatus(client: any, payload: any) {
    var authUserList = await this.receivingService.findStatus(payload.status);

    client.emit('store:findStatusItemReceive', authUserList);
    return;
  }

  @SubscribeMessage('store:findOneItemReceive')
  async findOne(client: any, payload: any) {
    var authUserList = await this.receivingService.findOne(payload.id);

    client.emit('store:findOneItemReceive', authUserList);
    return;
  }

  // gateway
  @SubscribeMessage('store:getDashboardStats')
  async getDashboardStats(
    client: any,
    payload: { period: 'day' | 'week' | 'month' },
  ) {
    const data = await this.receivingService.getStats(payload.period);
    client.emit('store:dashboardStats', data);
  }

  @SubscribeMessage('store:getDashboardRecent')
  async getDashboardRecent(client: any, payload: { limit?: number }) {
    const data = await this.receivingService.getRecent(payload.limit ?? 20);
    client.emit('store:dashboardRecent', { rows: data });
  }
}
