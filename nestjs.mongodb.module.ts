import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import applyIdTransform from './id-transform.plugin';
import timeSpanToUnix from './timespan-unix-converter';
import { softDeletePlugin } from './soft-delete.plugin';

@Module({
     imports: [
          MongooseModule.forRootAsync({
               useFactory: () => ({
                    // uri: /* YOUR MONGODB URI */,
                    connectionFactory: (conn: Connection) => {
                         conn.plugin(applyIdTransform);
                         conn.plugin(timeSpanToUnix);
                         conn.plugin(softDeletePlugin);
                         return conn;
                    },
               }),
          }),
     ],
})
export class MongoDbModule {}
