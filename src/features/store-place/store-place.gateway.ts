import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { StorePlaceService } from './store-place.service';

@WebSocketGateway()
export class StorePlaceGateway {
  @WebSocketServer() server: any;
  constructor(private readonly storePlaceService: StorePlaceService) {}

  async broadcastAuthList() {
    const list = await this.storePlaceService.findAll();
    this.server.emit('store:findAllStorePlace', list); // broadcast to all clients
  }

  @SubscribeMessage('store:findAllStorePlace')
  async findAll(client: any, payload: any) {
    var authUserList = await this.storePlaceService.findAll();

    client.emit('store:findAllStorePlace', authUserList);
    return;
  }

  @SubscribeMessage('store:findOneStorePlace')
  async findOne(client: any, payload: any) {
    var authUserList = await this.storePlaceService.findOne(payload.id);

    client.emit('store:findOneStorePlace', authUserList);
    return;
  }

  @SubscribeMessage('store:findAllStorePlaceQuantity')
  async findAllPlaceQuantity(client: any, payload: any) {
    var authUserList = await this.storePlaceService.findAllPlaceQuantity();

    client.emit('store:findAllStorePlaceQuantity', authUserList);
    return;
  }
}
