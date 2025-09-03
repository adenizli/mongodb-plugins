import { Schema } from 'mongoose';

/**
 * Mongoose plugin to replace `_id` with `id` and hide `__v` in JSON output.
 *
 * @param schema - Mongoose schema to apply transformation on
 */
export default function applyIdTransform(schema: Schema): void {
     schema.set('toJSON', {
          virtuals: true,
          versionKey: false,
          transform: (_doc: unknown, ret: Record<string, unknown>): void => {
               ret.id = String(ret._id);
               delete ret._id;
               delete ret.__v;
          },
     });
}
