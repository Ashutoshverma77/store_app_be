import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { StoreItemService } from './store-item.service';

@WebSocketGateway()
export class StoreItemGateway {
  @WebSocketServer() server: any;
  constructor(private readonly storeItemService: StoreItemService) {}

  async broadcastAuthList() {
    const list = await this.storeItemService.findAll();
    this.server.emit('store:findAllStoreItem', list); // broadcast to all clients
  }

  @SubscribeMessage('store:findAllStoreItem')
  async findAll(client: any, payload: any) {
    var authUserList = await this.storeItemService.findAll();

    client.emit('store:findAllStoreItem', authUserList);
    return;
  }

   @SubscribeMessage('store:findOneStoreItem')
  async findOne(client: any, payload: any) {
    var authUserList = await this.storeItemService.findOne(payload.id);

    client.emit('store:findOneStoreItem', authUserList);
    return;
  }
}
