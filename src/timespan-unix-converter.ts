import { Schema } from 'mongoose';

/**
 * Generates the current Unix timestamp in seconds.
 *
 * @returns Current Unix time (seconds)
 */
function generateUnixTime(): number {
     return Math.floor(Date.now() / 1000);
}

/**
 * Mongoose plugin to automatically set Unix timestamps on create and update.
 *
 * @param schema - Mongoose schema to attach hooks to
 */
export default function timeSpanToUnix(schema: Schema): void {
     schema.add({
          createdAt: {
               type: Number,
               required: true,
               index: true,
          },
          updatedAt: {
               type: Number,
               required: true,
               index: true,
          },
     });

     schema.pre('save', function (next) {
          if (this.isNew) this.createdAt = generateUnixTime();
          this.updatedAt = generateUnixTime();
          next();
     });

     schema.pre('findOneAndUpdate', function (next) {
          this.set({ updatedAt: generateUnixTime() });
          next();
     });
}
