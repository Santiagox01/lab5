import bcrypt from 'bcryptjs';
import { env, assertRuntimeEnv } from '../config/env';
import { connectDB, disconnectDB } from '../config/db';
import { User } from '../models/User';
import { Book, BookCategory, BookFormat } from '../models/Book';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';

interface SeedBookInput {
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
}

const DEMO_BOOKS: SeedBookInput[] = [
  {
    title: 'Arquitectura Limpia en TypeScript',
    author: 'Mateo Valdivia',
    isbn: '978-628-9501-01-4',
    description:
      'Patrones hexagonales, dominio desacoplado y límites de confianza para aplicaciones web full-stack con Node.js y Next.js.',
    category: 'Arquitectura',
    format: 'EPUB',
    price: 18.5,
    stock: 25,
    available: true,
    coverUrl: '/covers/book-01.svg',
    pages: 342,
    language: 'Español',
    publishedYear: 2026,
  },
  {
    title: 'Sistemas Agénticos con IA Generativa',
    author: 'Laura Restrepo',
    isbn: '978-628-9501-02-1',
    description:
      'Guía práctica de ingeniería de prompts, herramientas estructuradas, evaluación continua y despliegue seguro de asistentes inteligentes.',
    category: 'Inteligencia Artificial',
    format: 'PDF',
    price: 24.0,
    stock: 18,
    available: true,
    coverUrl: '/covers/book-02.svg',
    pages: 410,
    language: 'Español',
    publishedYear: 2026,
  },
  {
    title: 'Next.js y Node en Producción',
    author: 'Camilo Arango',
    isbn: '978-628-9501-03-8',
    description:
      'Separación de responsabilidades entre frontend SSR y APIs REST/WebSockets con MongoDB Atlas y pasarelas de pago verificadas.',
    category: 'Programación',
    format: 'EPUB',
    price: 16.9,
    stock: 30,
    available: true,
    coverUrl: '/covers/book-03.svg',
    pages: 296,
    language: 'Español',
    publishedYear: 2026,
  },
  {
    title: 'Diseño Editorial para Productos Digitales',
    author: 'Valeria Montoya',
    isbn: '978-628-9501-04-5',
    description:
      'Tipografía con propósito, jerarquía visual, contraste accesible y sistemas de diseño modernos aplicados a tiendas digitales.',
    category: 'Diseño',
    format: 'PDF',
    price: 14.5,
    stock: 14,
    available: true,
    coverUrl: '/covers/book-04.svg',
    pages: 228,
    language: 'Español',
    publishedYear: 2025,
  },
  {
    title: 'Crónicas de la Órbita Silenciosa',
    author: 'Elena Quiroga',
    isbn: '978-628-9501-05-2',
    description:
      'Novela de ciencia ficción dura sobre bibliotecarios estelares que preservan archivos culturales en estaciones autónomas.',
    category: 'Ciencia Ficción',
    format: 'Audiolibro',
    price: 12.9,
    stock: 40,
    available: true,
    coverUrl: '/covers/book-05.svg',
    pages: 380,
    language: 'Español',
    publishedYear: 2026,
  },
  {
    title: 'Economía de Plataformas y Suscripciones',
    author: 'Andrés Salgado',
    isbn: '978-628-9501-06-9',
    description:
      'Métricas unitarias, logística digital, retención de lectores y estrategias de monetización ética para editoriales independientes.',
    category: 'Negocios',
    format: 'EPUB',
    price: 19.9,
    stock: 12,
    available: true,
    coverUrl: '/covers/book-06.svg',
    pages: 264,
    language: 'Español',
    publishedYear: 2025,
  },
  {
    title: 'MongoDB Atlas y Modelado Orientado a Eventos',
    author: 'Julián Castaño',
    isbn: '978-628-9501-07-6',
    description:
      'Índices compuestos, idempotencia de pagos, máquinas de estados y consultas de alta concurrencia en bases documentales.',
    category: 'Arquitectura',
    format: 'Edición Impresa + eBook',
    price: 34.0,
    stock: 3, // Stock bajo para demostrar alertas en panel admin y catálogo
    available: true,
    coverUrl: '/covers/book-07.svg',
    pages: 455,
    language: 'Español',
    publishedYear: 2026,
  },
  {
    title: 'Seguridad Web y Auditoría de APIs REST',
    author: 'Sofía Benítez',
    isbn: '978-628-9501-08-3',
    description:
      'OWASP API Top 10, control de acceso basado en roles, prevención de manipulación de precios y hardening en la nube.',
    category: 'Programación',
    format: 'PDF',
    price: 21.5,
    stock: 16,
    available: true,
    coverUrl: '/covers/book-08.svg',
    pages: 318,
    language: 'Español',
    publishedYear: 2026,
  },
  {
    title: 'Matemática Visual para Machine Learning',
    author: 'Tomás Giraldo',
    isbn: '978-628-9501-09-0',
    description:
      'Álgebra lineal, optimización y probabilidad explicadas con diagramas geométricos e implementaciones paso a paso.',
    category: 'Inteligencia Artificial',
    format: 'Edición Impresa + eBook',
    price: 29.9,
    stock: 9,
    available: true,
    coverUrl: '/covers/book-09.svg',
    pages: 390,
    language: 'Español',
    publishedYear: 2026,
  },
  {
    title: 'Edición Limitada: Algoritmos del Sur',
    author: 'Daniela Echeverri',
    isbn: '978-628-9501-10-6',
    description:
      'Antología de ensayos sobre historia de la computación en América Latina, con prólogo ilustrado y notas técnicas.',
    category: 'Ciencia Ficción',
    format: 'Edición Impresa + eBook',
    price: 39.9,
    stock: 0, // Agotado para pruebas de bloqueo de compra y reposición de stock
    available: false,
    coverUrl: '/covers/book-10.svg',
    pages: 312,
    language: 'Español',
    publishedYear: 2025,
  },
];

async function runSeed(): Promise<void> {
  assertRuntimeEnv();
  await connectDB(env.mongodbUri);
  await Book.syncIndexes();

  const clientHash = await bcrypt.hash('Cliente123!', 10);
  const adminHash = await bcrypt.hash('Admin123!', 10);

  const clienteUser = await User.findOneAndUpdate(
    { email: 'cliente@libroya.com' },
    {
      name: 'Camila Lectora',
      email: 'cliente@libroya.com',
      passwordHash: clientHash,
      role: 'cliente',
    },
    { upsert: true, new: true }
  );

  await User.findOneAndUpdate(
    { email: 'admin@libroya.com' },
    {
      name: 'Diego Gestor Editorial',
      email: 'admin@libroya.com',
      passwordHash: adminHash,
      role: 'administrador',
    },
    { upsert: true, new: true }
  );

  const seededBooks = [];
  for (const item of DEMO_BOOKS) {
    const book = await Book.findOneAndUpdate(
      { isbn: item.isbn },
      { $set: item },
      { upsert: true, new: true }
    );
    seededBooks.push(book);
  }

  // Crear pedidos demo solo si aún no existen
  const demoOrders = [
    {
      orderNumber: 'LY-2026-DEMO01',
      book: seededBooks[0],
      status: 'PAID' as const,
      shippingMethod: 'DIGITAL_INSTANT' as const,
      shippingCost: 0,
      trackingCode: '',
      paypalOrderId: 'DEMO-PP-ORDER-001',
      captureId: 'DEMO-PP-CAP-001',
    },
    {
      orderNumber: 'LY-2026-DEMO02',
      book: seededBooks[6],
      status: 'PREPARING' as const,
      shippingMethod: 'EXPRESS' as const,
      shippingCost: 9.99,
      trackingCode: '',
      paypalOrderId: 'DEMO-PP-ORDER-002',
      captureId: 'DEMO-PP-CAP-002',
    },
  ];

  for (const demo of demoOrders) {
    const exists = await Order.findOne({ orderNumber: demo.orderNumber });
    if (!exists && demo.book) {
      const subtotal = demo.book.price;
      const total = Math.round((subtotal + demo.shippingCost) * 100) / 100;
      const order = await Order.create({
        orderNumber: demo.orderNumber,
        userId: clienteUser._id,
        items: [
          {
            bookId: demo.book._id,
            title: demo.book.title,
            author: demo.book.author,
            format: demo.book.format,
            coverUrl: demo.book.coverUrl,
            unitPrice: demo.book.price,
            quantity: 1,
            subtotal,
          },
        ],
        shippingAddress: {
          fullName: 'Camila Lectora',
          street: 'Calle 67 # 53-108',
          city: 'Medellín',
          postalCode: '050010',
          country: 'Colombia',
          notes: 'Entrega de demostración',
        },
        shippingMethod: demo.shippingMethod,
        shippingCost: demo.shippingCost,
        trackingCode: demo.trackingCode,
        subtotal,
        total,
        status: demo.status,
        paymentStatus: 'CAPTURED',
        paypalOrderId: demo.paypalOrderId,
        paidAt: new Date(),
      });

      await Payment.create({
        orderId: order._id,
        userId: clienteUser._id,
        provider: 'PAYPAL',
        providerOrderId: demo.paypalOrderId,
        captureId: demo.captureId,
        amount: total,
        currency: 'USD',
        status: 'CAPTURED',
        payerEmail: 'sandbox-buyer@libroya.com',
      });
    }
  }

  console.log(
    `Seed completado: 2 usuarios demo, ${seededBooks.length} libros en catálogo y pedidos iniciales listos.`
  );
  await disconnectDB();
}

runSeed().catch(async (err) => {
  console.error(
    '[SEED ERROR]',
    err instanceof Error ? err.message : 'Error ejecutando seed'
  );
  await disconnectDB();
  process.exit(1);
});
