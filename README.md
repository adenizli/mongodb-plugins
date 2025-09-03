# MongoDB Plugins Collection

A comprehensive collection of production-ready MongoDB/Mongoose plugins for Node.js applications, providing essential features like ID transformation, soft delete functionality, and automatic timestamp management.

## 🚀 Features

- **Soft Delete Plugin**: Implements soft deletion with Unix timestamps and query filtering
- **ID Transform Plugin**: Converts MongoDB `_id` to `id` and removes version keys from JSON output
- **Timestamp Plugin**: Automatic Unix timestamp management for `createdAt` and `updatedAt` fields
- **NestJS Integration**: Ready-to-use NestJS module with all plugins pre-configured
- **TypeScript Support**: Full type definitions and strict typing
- **Performance Optimized**: Minimal overhead with efficient query filtering and indexing

## 📦 Installation

```bash
npm install mongodb-plugins
```

## 🔧 Requirements

- **Node.js**: >= 14.0.0
- **Mongoose**: >= 6.0.0

## 🛠 Usage

### Individual Plugin Usage

#### 1. Soft Delete Plugin

The soft delete plugin enables logical deletion of documents using Unix timestamps, allowing for easy recovery and audit trails.

```typescript
import mongoose from 'mongoose';
import { softDeletePlugin } from 'mongodb-plugins';

const UserSchema = new mongoose.Schema({
  name: String,
  email: String
});

// Apply the plugin
UserSchema.plugin(softDeletePlugin);

const User = mongoose.model('User', UserSchema);

// Usage examples
const user = new User({ name: 'John', email: 'john@example.com' });
await user.save();

// Soft delete a document
await user.softDelete(); // Sets deletedAt to current Unix timestamp

// Restore a soft deleted document
await user.restore(); // Sets deletedAt to null

// Query operations (automatically excludes soft deleted)
const activeUsers = await User.find({}); // Only non-deleted documents

// Include soft deleted documents
const allUsers = await User.find({}).withDeleted();

// Only soft deleted documents
const deletedUsers = await User.find({}).onlyDeleted();

// Bulk operations
await User.softDelete({ role: 'admin' }); // Soft delete all admin users
await User.restore({ role: 'admin' }); // Restore all admin users
```

**Key Features:**
- Automatic filtering of deleted documents from queries
- Support for all Mongoose query methods (`find`, `findOne`, `count`, `update`, etc.)
- Aggregation pipeline support
- Bulk soft delete and restore operations
- Query helpers: `withDeleted()`, `onlyDeleted()`
- Unix timestamp storage for efficient indexing and sorting

#### 2. ID Transform Plugin

Transforms MongoDB's `_id` field to `id` in JSON responses and removes version keys for cleaner API outputs.

```typescript
import mongoose from 'mongoose';
import { applyIdTransform } from 'mongodb-plugins';

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number
});

// Apply the plugin
ProductSchema.plugin(applyIdTransform);

const Product = mongoose.model('Product', ProductSchema);

const product = new Product({ name: 'Laptop', price: 999 });
await product.save();

// JSON output transformation
console.log(product.toJSON());
// Output: { id: '507f1f77bcf86cd799439011', name: 'Laptop', price: 999 }
// Instead of: { _id: ObjectId('507f1f77bcf86cd799439011'), name: 'Laptop', price: 999, __v: 0 }
```

**Key Features:**
- Converts `_id` to `id` string representation
- Removes `__v` version key from JSON output
- Enables virtual field inclusion
- Zero performance impact on database operations

#### 3. Timestamp Plugin

Automatically manages `createdAt` and `updatedAt` fields using Unix timestamps for better performance and consistency.

```typescript
import mongoose from 'mongoose';
import { timeSpanToUnix } from 'mongodb-plugins';

const ArticleSchema = new mongoose.Schema({
  title: String,
  content: String
});

// Apply the plugin
ArticleSchema.plugin(timeSpanToUnix);

const Article = mongoose.model('Article', ArticleSchema);

// Automatic timestamp management
const article = new Article({ title: 'Hello World', content: 'Content here' });
await article.save();
// createdAt and updatedAt are automatically set to current Unix timestamp

// Update operations
article.title = 'Updated Title';
await article.save();
// updatedAt is automatically updated to current Unix timestamp

// Find and update operations
await Article.findOneAndUpdate(
  { _id: article._id },
  { content: 'New content' }
);
// updatedAt is automatically updated
```

**Key Features:**
- Automatic `createdAt` timestamp on document creation
- Automatic `updatedAt` timestamp on save and update operations
- Unix timestamp format for efficient storage and querying
- Indexed fields for optimized sorting and filtering
- Support for `findOneAndUpdate` operations

### NestJS Integration

For NestJS applications, use the pre-configured module that applies all plugins globally:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MongoDbModule } from 'mongodb-plugins';

@Module({
  imports: [
    MongoDbModule.forRootAsync({
      useFactory: () => ({
        uri: 'mongodb://localhost:27017/your-database',
        // All plugins are automatically applied to all schemas
      }),
    }),
  ],
})
export class AppModule {}
```

**Alternative Manual Configuration:**

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { applyIdTransform, timeSpanToUnix, softDeletePlugin } from 'mongodb-plugins';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: 'mongodb://localhost:27017/your-database',
        connectionFactory: (connection: Connection) => {
          // Apply plugins globally to all schemas
          connection.plugin(applyIdTransform);
          connection.plugin(timeSpanToUnix);
          connection.plugin(softDeletePlugin);
          return connection;
        },
      }),
    }),
  ],
})
export class AppModule {}
```

## 🏗 Architecture & Design Approaches

### 1. Plugin Architecture Design

This library follows a **modular plugin architecture** that leverages Mongoose's built-in plugin system:

```typescript
// Core plugin structure
export function pluginName(schema: Schema, options?: PluginOptions) {
  // Schema modifications
  schema.add({ /* new fields */ });
  
  // Middleware hooks
  schema.pre('operation', function() { /* logic */ });
  schema.post('operation', function() { /* logic */ });
  
  // Instance methods
  schema.method('methodName', function() { /* logic */ });
  
  // Static methods
  schema.static('methodName', function() { /* logic */ });
}
```

**Benefits:**
- **Composability**: Plugins can be combined without conflicts
- **Reusability**: Apply to any schema with consistent behavior
- **Maintainability**: Each plugin handles a single responsibility
- **Extensibility**: Easy to add new plugins or modify existing ones

### 2. Soft Delete Implementation Strategy

The soft delete plugin uses a **timestamp-based approach** with sophisticated query filtering:

#### Core Concepts:

1. **Unix Timestamp Storage**: Uses `Number` type storing Unix seconds for efficiency
2. **Query Interception**: Hooks into all query operations to automatically filter
3. **Conditional Logic**: Three modes - exclude deleted (default), include all, only deleted
4. **Aggregation Support**: Extends filtering to MongoDB aggregation pipelines

#### Technical Implementation:

```typescript
// Filtering strategy
const notDeleted = () => ({ 
  $or: [
    { [field]: { $exists: false } }, 
    { [field]: null }
  ] 
});

const isDeleted = () => ({ [field]: { $type: 'number' } });

// Query interception
methods.forEach(method =>
  schema.pre(method, function() {
    const options = this.getOptions();
    if (!options.withDeleted && !options.onlyDeleted) {
      // Apply deletion filter
      this.where(notDeleted());
    }
  })
);
```

**Design Decisions:**
- **Unix timestamps** over ISO dates for better performance and smaller storage
- **Null vs undefined** distinction for explicit restoration tracking  
- **Query option propagation** for flexible filtering control
- **Index optimization** on deletedAt field for fast filtering

### 3. ID Transformation Approach

The ID transform plugin uses Mongoose's **JSON transformation feature**:

#### Strategy:

1. **toJSON Override**: Modifies the JSON serialization behavior
2. **Non-Destructive**: Original `_id` remains unchanged in database
3. **String Conversion**: Ensures consistent string representation
4. **Clean Output**: Removes internal MongoDB fields from API responses

#### Implementation Philosophy:

```typescript
schema.set('toJSON', {
  virtuals: true,           // Include virtual fields
  versionKey: false,        // Remove __v
  transform: (doc, ret) => {
    ret.id = String(ret._id); // Convert ObjectId to string
    delete ret._id;           // Remove original _id
    delete ret.__v;           // Remove version key
  },
});
```

**Benefits:**
- **API Consistency**: Clean, predictable JSON responses
- **Client Compatibility**: Standard `id` field expected by frontend frameworks
- **Database Integrity**: No impact on database structure or queries

### 4. Timestamp Management Strategy

The timestamp plugin implements **automatic lifecycle management**:

#### Approach:

1. **Schema Enhancement**: Adds indexed timestamp fields
2. **Lifecycle Hooks**: Intercepts save and update operations
3. **Unix Time Standard**: Consistent timestamp format across the application
4. **Update Detection**: Handles both instance saves and query updates

#### Hook Strategy:

```typescript
schema.pre('save', function(next) {
  if (this.isNew) this.createdAt = generateUnixTime();
  this.updatedAt = generateUnixTime();
  next();
});

schema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: generateUnixTime() });
  next();
});
```

**Design Principles:**
- **Automatic Management**: Zero developer intervention required
- **Consistency**: Unix timestamps across all documents
- **Performance**: Indexed fields for efficient queries
- **Coverage**: Handles all common update patterns

### 5. TypeScript Integration Strategy

Comprehensive TypeScript support through:

1. **Interface Extensions**: Extends Mongoose types for plugin functionality
2. **Generic Support**: Type-safe query helpers and methods
3. **Declaration Merging**: Seamlessly integrates with existing Mongoose types
4. **Strict Typing**: Full type checking without any compromises

```typescript
// Type extensions example
declare module 'mongoose' {
  interface QueryOptions extends SoftDeleteQueryOptions {}
}

interface SoftDeleteQueryHelpers {
  withDeleted(): this;
  onlyDeleted(): this;
}
```

## 🎯 Performance Considerations

### Database Indexing
All plugins automatically create appropriate indexes:
- `deletedAt`: Sparse index for soft delete filtering
- `createdAt` & `updatedAt`: Indexes for timestamp-based queries

### Query Optimization
- Soft delete filtering uses efficient MongoDB operators
- Unix timestamps enable fast numerical comparisons
- Minimal query overhead through strategic pre-hook placement

### Memory Efficiency
- No additional in-memory storage requirements
- Minimal plugin footprint
- Efficient query plan generation

## 🔍 Testing & Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Development mode (watch for changes)
npm run dev

# Clean build artifacts
npm run clean

# Prepare for publishing
npm run prepublishOnly
```

## 📝 API Reference

### Soft Delete Plugin

#### Instance Methods
- `document.softDelete()`: Soft delete the document
- `document.restore()`: Restore a soft deleted document

#### Static Methods  
- `Model.softDelete(filter)`: Bulk soft delete documents matching filter
- `Model.restore(filter)`: Bulk restore documents matching filter

#### Query Helpers
- `query.withDeleted()`: Include soft deleted documents in results
- `query.onlyDeleted()`: Return only soft deleted documents

### ID Transform Plugin

Automatically applied to `toJSON()` method - no additional API.

### Timestamp Plugin

Automatically manages `createdAt` and `updatedAt` fields - no additional API.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Ahmet Sait Denizli**

- GitHub: [@ahmetsaitdenizli](https://github.com/ahmetsaitdenizli)
- Email: [your-email@example.com]

## 🙏 Acknowledgments

- Built with [Mongoose](https://mongoosejs.com/) - Elegant MongoDB object modeling for Node.js
- Inspired by real-world production needs and common MongoDB patterns
- Designed for seamless integration with [NestJS](https://nestjs.com/) applications

---

**Made with ❤️ for the MongoDB/Node.js community**