import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { StoreNewItemService } from './store-item.service';
import { ItemPagedQueryDto, ReceivePagedQueryDto } from './dto/store-item.dto';

@WebSocketGateway({ cors: true })
export class StoreNewItemGateway {
  @WebSocketServer() server: any;
  constructor(private readonly s: StoreNewItemService) {}

  async broadcastAllList() {
    const list = await this.s.findAllPaged({
      page: 1,
      limit: 12,
      search: '',
      sort: '-createdAt',
    });
    this.server.emit('store:findAllItemPaged', list); // broadcast to all clients
  }

  async broadcastAllScrapList() {
    const list = await this.s.findAllPaged({
      page: 1,
      limit: 12,
      search: '',
      sort: '-createdAt',
    });
    this.server.emit('store:findScrapAllItemPaged', list); // broadcast to all clients
  }

  async broadcastAllReceiveList() {
    const list = await this.s.findAllPaged({
      page: 1,
      limit: 12,
      search: '',
      sort: '-createdAt',
    });
    this.server.emit('store:findAllReceivePaged', list); // broadcast to all clients
  }

  @SubscribeMessage('store:findRealAllItemPaged')
  async findRealAllPaged(
    @ConnectedSocket() client: Socket,
    @MessageBody() q: ItemPagedQueryDto,
  ) {
    const data = await this.s.findRealAllPaged();
    client.emit('store:findRealAllItemPaged', data);
  }

  @SubscribeMessage('store:findAllItemPaged')
  async findAllPaged(
    @ConnectedSocket() client: Socket,
    @MessageBody() q: ItemPagedQueryDto,
  ) {
    const data = await this.s.findAllPaged(q || {});
    client.emit('store:findAllItemPaged', data);
  }

  @SubscribeMessage('store:findScrapAllItemPaged')
  async findScrapAllItemPaged(
    @ConnectedSocket() client: Socket,
    @MessageBody() q: ItemPagedQueryDto,
  ) {
    const data = await this.s.findScrapAllItemPaged(q || {});
    client.emit('store:findScrapAllItemPaged', data);
  }

  @SubscribeMessage('store:findOneItem')
  async findOne(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { id: string },
  ) {
    const data = await this.s.findOne(body?.id);

    console.log(data);

    client.emit('store:findOneItem', { id: body.id, data });
  }

  @SubscribeMessage('store:sameItemRacks:req')
  async sameItemRacksGet(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const itemId = String(body?.itemId || '').trim();
    const rows = await this.s.getSameItemRacks(itemId);

    client.emit('store:sameItemRacks:res', rows);
  }

  @SubscribeMessage('store:sameItemRacksWithItemAndRack')
  async getSameItemByRacks(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const itemId = String(body?.itemId || '').trim();
    const rackId = String(body?.rackId || '').trim();
    const rows = await this.s.getSameItemByRacks(itemId, rackId);

    client.emit('store:sameItemRacksWithItemAndRack', rows);
  }

  @SubscribeMessage('store:rackItem')
  async rackItem(@ConnectedSocket() client: Socket, @MessageBody() body: any) {
    const rackId = String(body?.rackId || '').trim();
    const item = await this.s.getItemByRack(rackId); // returns item or null
    client.emit('store:rackItem', item); // map or null
  }

  @SubscribeMessage('store:itemNameRacks')
  async itemNameRacks(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const itemNameId = String(body?.itemNameId || '').trim();
    const rows = await this.s.getItemNameRacks(itemNameId);
    client.emit('store:itemNameRacks', rows);
  }

  @SubscribeMessage('store:itemsubcategory')
  async itemsubcategory(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const itemId = String(body?.itemId || '').trim();
    const rows = await this.s.itemsubcategory(itemId);

    console.log(rows);

    client.emit('store:itemsubcategory', rows);
  }

  @SubscribeMessage('store:itemOne')
  async itemOne(@ConnectedSocket() client: Socket, @MessageBody() body: any) {
    const itemId = String(body?.itemId || '').trim();

    const item = await this.s.itemOne(itemId); // returns item or null
    // console.log(item);
    client.emit('store:itemOne', item); // map or null
  }

  @SubscribeMessage('store:findOneRack')
  async findOneRack(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const rackId = String(body?.rackId || '').trim();

    const item = await this.s.findOneRack(rackId); // returns item or null
    // console.log(item);
    client.emit('store:findOneRack', item); // map or null
  }

  @SubscribeMessage('store:scrapItemAllData')
  async scrapItem(@ConnectedSocket() client: Socket, @MessageBody() body: any) {
    const itemId = String(body?.itemId || '').trim();

    const item = await this.s.scrapItem(body); // returns item or null
    console.log(item);
    client.emit('store:scrapItemAllData', item); // map or null
  }

  @SubscribeMessage('store:findAllReceivePaged')
  async findAllReceivePaged(
    @ConnectedSocket() client: Socket,
    @MessageBody() q: ReceivePagedQueryDto,
  ) {
    // console.log(q);

    const data = await this.s.findAllReceivePaged(q || {});

    console.log(data);

    client.emit('store:findAllReceivePaged', data);
  }
}
