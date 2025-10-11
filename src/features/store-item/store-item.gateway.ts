import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as storeItemService from './store-item.service';

@WebSocketGateway()
export class StoreItemGateway {
  @WebSocketServer() server: any;
  constructor(
    private readonly storeItemService: storeItemService.StoreItemService,
  ) {}

  async broadcastStoreItems() {
    const list = await this.storeItemService.findPaged({
      page: 1,
      limit: 8,
      search: '',
      sort: '-createdAt',
    });
    this.server.emit('store:findAllStoreItemFilter', list); // broadcast to all clients
  }

  @SubscribeMessage('store:findAllStoreItem')
  async findAll(client: any, payload: any) {
    var authUserList = await this.storeItemService.findAll();

    client.emit('store:findAllStoreItem', authUserList);
    return;
  }

  @SubscribeMessage('store:findAllStoreItemFilter')
  async findAllPaged(client: any, payload: any) {
    try {
      const result = await this.storeItemService.findPaged({
        page: payload?.page,
        limit: payload?.limit,
        search: payload?.search,
        sort: payload?.sort,
      });

      console.log(result);
      client.emit('store:findAllStoreItemFilter', result);
    } catch (e) {
      client.emit('store:findAllStoreItemFilter', {
        rows: [],
        total: 0,
        page: Number(payload?.page ?? 1),
        limit: Number(payload?.limit ?? 12),
        error: 'Failed to fetch items',
      });
    }
  }
  // Broadcast (same event name). You can call this whenever items change.

  @SubscribeMessage('store:findOneStoreItem')
  async findOne(client: any, payload: any) {

    
    var authUserList = await this.storeItemService.findOne(payload.id);

    client.emit('store:findOneStoreItem', authUserList);
    return;
  }

  @SubscribeMessage('store:findScrapStoreItem')
  async findItemScrap(client: any) {
    var authUserList = await this.storeItemService.listScrap();

    client.emit('store:findScrapStoreItem', authUserList);
    return;
  }

  // server/src/store/scrap.gateway.ts (or inside your existing gateway)
  @SubscribeMessage('store:listScrapPaged')
  async listScrapPaged(client: any, body: any) {
    var authUserList = await this.storeItemService.listScrapPaged(body);
    client.emit('store:listScrapPaged', authUserList);
  }
}
