// issue.gateway.ts
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { IssueService } from './store-item-issue.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class IssueGateway {
  @WebSocketServer() server: any;
  constructor(private readonly s: IssueService) {}

  @SubscribeMessage('store:issue:sources')
  async sources(@ConnectedSocket() client: Socket, @MessageBody() body: any) {
    const itemId = String(body?.itemId || '').trim();
    const data = await this.s.getIssueSourcesForSelectedItem(itemId);
    client.emit('store:issue:sources', data);
  }

  @SubscribeMessage('store:issueByIdItem')
  async sourcesissueByIdItem(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    // console.log(body);
    // const itemId = String(body?.issueId || '').trim();
    const data = await this.s.findIssuesByLineItemId(body);

    // console.log(data);

    client.emit('store:issueByIdItem', data);
  }

  @SubscribeMessage('store:issues:list')
  async issuesList(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const data = await this.s.findAllIssuesPaged(body);

    // respond on SAME event name (like your other ws)
    client.emit('store:issues:list', data);
  }

  async broadcastAllIssueList() {
    var body = { sort: '-createdAt', search: '', page: 1, limit: 10 };
    const list = await this.s.findAllIssuesPaged(body);
    this.server.emit('store:issues:list', list); // broadcast to all clients
  }
}
