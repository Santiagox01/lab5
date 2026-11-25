import mongoose, { Document, Schema } from 'mongoose';

export const BOOK_CATEGORIES = [
  'Programación',
  'Inteligencia Artificial',
  'Arquitectura',
  'Ciencia Ficción',
  'Negocios',
  'Diseño',
] as const;

export const BOOK_FORMATS = [
  'EPUB',
  'PDF',
  'Audiolibro',
  'Edición Impresa + eBook',
] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number];
export type BookFormat = (typeof BOOK_FORMATS)[number];

export interface IBook extends Document {
  title: string;
  author: string;
  isbn: string;
  description: string;
  category: BookCategory;
  format: BookFormat;
  price: number;
  stock: number;
  available: boolean;
  coverUrl: string;
  pages: number;
  language: string;
  publishedYear: number;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
    },
    author: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 140,
    },
    isbn: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 32,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: BOOK_CATEGORIES,
      required: true,
    },
    format: {
      type: String,
      enum: BOOK_FORMATS,
      required: true,
      default: 'EPUB',
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'El stock debe ser un número entero no negativo.',
      },
    },
    available: {
      type: Boolean,
      required: true,
      default: true,
    },
    coverUrl: {
      type: String,
      required: true,
      trim: true,
    },
    pages: {
      type: Number,
      required: true,
      min: 1,
      default: 240,
    },
    language: {
      type: String,
      required: true,
      trim: true,
      default: 'Español',
    },
    publishedYear: {
      type: Number,
      required: true,
      min: 1950,
      max: 2100,
      default: 2026,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

bookSchema.index({ category: 1, format: 1, available: 1 });

export const Book = mongoose.model<IBook>('Book', bookSchema);
