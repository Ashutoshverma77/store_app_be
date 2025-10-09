import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Version } from 'src/features/auth/schema/version.schema';

@Injectable()
export class UpdateService {
  constructor(
    @InjectModel(Version.name, 'auth')
    private versionSchema: Model<Version>,
  ) {}

  async cheakVersion(type: String) {
    var checkVarsion = await this.versionSchema
      .findOne({ type: type, appName: 'storeApp' })
      .sort({ createdAt: -1 });
    return checkVarsion;
  }
}
