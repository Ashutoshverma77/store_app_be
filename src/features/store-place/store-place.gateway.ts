import {
  MessageBody,
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
    const list = await this.storePlaceService.findPaged({
      page: 1,
      limit: 8,
      search: '',
      sort: '-createdAt',
    });
    this.server.emit('store:findAllStorePlace', list); // broadcast to all clients
  }

  @SubscribeMessage('store:findAllStorePlace')
  async findAll(client: any, payload: any) {
    var authUserList = await this.storePlaceService.findAll();

    client.emit('store:findAllStorePlace', authUserList);
    return;
  }

  // gateway
  @SubscribeMessage('store:findAllStorePlace')
  async findAllPaged(client: any, payload: any) {
    const page = Number(payload?.page ?? 1);
    const limit = Number(payload?.limit ?? 12);
    const search = String(payload?.search ?? '');
    const sort = String(payload?.sort ?? '-createdAt');

    const result = await this.storePlaceService.findPaged({
      page,
      limit,
      search,
      sort,
    });
    client.emit('store:findAllStorePlace', result);
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

  @SubscribeMessage('stock:listPlaceItems')
  async listPlaceItems(client: any, body: any) {
    const data = await this.storePlaceService.listPlaceItems({
      placeId: String(body?.placeId ?? ''),
      itemId: body?.itemId ? String(body.itemId) : undefined,
      search: body?.search ? String(body.search) : undefined,
      limit: body?.limit ? Number(body.limit) : 200,
    });
    console.log(data);
    client.emit('stock:listPlaceItems', data);
    // reply on same event name (your convention)
    return;
  }
}
