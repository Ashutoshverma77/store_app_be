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
    console.log(body);
    const itemId = String(body?.issueId || '').trim();
    const data = await this.s.findIssuesByLineItemId(itemId);

    console.log(data);

    client.emit('store:issueByIdItem', data);
  }

  @SubscribeMessage('store:issues:list')
  async issuesList(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const reqId = String(body?.reqId || '').trim();

    try {
      const data = await this.s.findAllIssuesPaged(body);

      // respond on SAME event name (like your other ws)
      client.emit('store:issues:list', {
        reqId,
        ok: true,
        ...data,
      });
    } catch (e: any) {
      client.emit('store:issues:list', {
        reqId,
        ok: false,
        message: e?.message || 'Failed to load issues',
        rows: [],
        meta: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    }
  }

  async broadcastAllIssueList() {
    const list = await this.s.findAllIssuesPaged({
      search: '',
      page: 1,
      limit: 10,
    });
    this.server.emit('store:issues:list', {
      reqId: '',
      ok: true,
      ...list,
    }); // broadcast to all clients
  }
}
