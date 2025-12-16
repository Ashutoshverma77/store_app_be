// src/grade/grade.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

import { GradeService } from './grade.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class GradeGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gradeService: GradeService) {}

  // CLIENT -> SERVER
  @SubscribeMessage('grade:findAllGrade')
  async handleFindAll(@MessageBody() _data: any) {
    const grades = await this.gradeService.findAll();
    // SERVER -> CLIENT (broadcast all)
    this.server.emit('grade:findAllGrade', grades);
  }

  // Helper to broadcast fresh list after CRUD
  async broadcastGrades() {
    const grades = await this.gradeService.findAll();
    this.server.emit('grade:findAllGrade', grades);
  }
}
