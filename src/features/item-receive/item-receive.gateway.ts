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
    const list = await this.receivingService.findAll();
    this.server.emit('store:findAllItemReceive', list); // broadcast to all clients
  }

  @SubscribeMessage('store:findAllItemReceive')
  async findAll(client: any, payload: any) {
    var authUserList = await this.receivingService.findAll();

    client.emit('store:findAllItemReceive', authUserList);
    return;
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
}
