// libs/mongoose/soft-delete.plugin.ts
import { Schema, Query, Model } from 'mongoose';

/**
 * Generates the current Unix timestamp in seconds.
 *
 * @returns Current Unix time (seconds)
 */
function generateUnixTime(): number {
     return Math.floor(Date.now() / 1000);
}

// Define proper interfaces
interface SoftDeleteQueryHelpers {
     withDeleted(): this;
     onlyDeleted(): this;
}

interface SoftDeleteQueryOptions {
     withDeleted?: boolean;
     onlyDeleted?: boolean;
}

// Extend Mongoose types
declare module 'mongoose' {
     interface QueryOptions extends SoftDeleteQueryOptions {}
}

export function softDeletePlugin(schema: Schema) {
     const opts = {
          field: 'deletedAt',
          defaultFilter: 'exclude',
     };

     // Ensure the field exists and is indexed (number = epoch ms)
     schema.add({ [opts.field]: { type: Number, index: true } });

     const notDeleted = () => ({ $or: [{ [opts.field]: { $exists: false } }, { [opts.field]: null }] });
     const isDeleted = () => ({ [opts.field]: { $type: 'number' } });

     // Helpers
     // @ts-ignore
     schema.query.withDeleted = function <T>(this: Query<T, any>) {
          this.setOptions({ withDeleted: true });
          return this;
     };
     // @ts-ignore
     schema.query.onlyDeleted = function <T>(this: Query<T, any>) {
          this.setOptions({ onlyDeleted: true });
          return this;
     };

     // Apply to all relevant query ops
     const methods = [
          'find',
          'findOne',
          'count',
          'countDocuments',
          'distinct',
          'update',
          'updateOne',
          'updateMany',
          'findOneAndUpdate',
          'findOneAndDelete',
          'findOneAndRemove',
          'exists',
     ] as const;

     function apply<T>(q: Query<T, any>) {
          const qopts = (q.getOptions() as SoftDeleteQueryOptions) ?? {};
          const only = qopts.onlyDeleted || opts.defaultFilter === 'only';
          const include = qopts.withDeleted || opts.defaultFilter === 'include';

          if (include && !only) return;

          const cond = only ? isDeleted() : notDeleted();
          const current = q.getFilter() ?? {};
          const hasFilter = Object.keys(current).length > 0;

          if (!hasFilter) {
               q.where(cond);
          } else {
               q.setQuery({ $and: [current, cond] });
          }
     }

     methods.forEach(m =>
          schema.pre(m as any, function () {
               apply(this as any);
          })
     );

     // Aggregations
     schema.pre('aggregate', function (this: any) {
          const aopts: SoftDeleteQueryOptions = this.options ?? {};
          const only = aopts.onlyDeleted === true || opts.defaultFilter === 'only';
          const include = aopts.withDeleted === true || opts.defaultFilter === 'include';
          if (include && !only) return;
          this.pipeline().unshift({ $match: only ? isDeleted() : notDeleted() });
     });

     // Instance + static (bulk) helpers
     schema.method('softDelete', function () {
          (this as any)[opts.field] = generateUnixTime();
          return (this as any).save();
     });
     schema.method('restore', function () {
          (this as any)[opts.field] = null;
          return (this as any).save();
     });

     schema.static('softDelete', function <T>(this: Model<T>, filter = {}) {
          return this.updateMany(filter, { $set: { deletedAt: generateUnixTime() } });
     });
     schema.static('restore', function <T>(this: Model<T>, filter = {}) {
          return this.updateMany(filter, { $set: { deletedAt: null } });
     });
}
