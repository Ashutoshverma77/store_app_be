import * as Minio from 'minio';

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || '192.168.13.62',
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'uXgiyxKRlviRvIDvolPX',
  secretKey:
    process.env.MINIO_SECRET_KEY || 'vCyBd3GQtRFtt4mSjrWS5D2mJYhjkP2tuGJzeXTi',
});

