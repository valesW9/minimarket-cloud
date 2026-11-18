'use strict';
const demoProducts = [
  {id:1,name:'Leche 1 L',price:1300,stock:20},
  {id:2,name:'Pan integral',price:2200,stock:15},
  {id:3,name:'Arroz 1 kg',price:1800,stock:30},
  {id:4,name:'Huevos (docena)',price:3900,stock:10}
];
class MemoryStore {
  constructor(){this.products=demoProducts.map(p=>({...p}));this.orders=[];this.moves=[];this.nextProduct=5;this.nextOrder=1;}
  async listProducts(){return this.products.map(p=>({...p}));}
  async createProduct(v){const p={id:this.nextProduct++,name:v.name,price:v.price,stock:v.stock};this.products.push(p);return {...p};}
  async updateStock(id,stock){const p=this.products.find(p=>p.id===id);if(!p)return null;const before=p.stock;p.stock=stock;this.moves.push({productId:id,before,after:stock,reason:'ajuste',date:new Date().toISOString()});return {...p};}
  async createOrder(items){
    // La seccion sin await es atomica dentro de la instancia Node local.
    const quantities=new Map();for(const item of items)quantities.set(item.productId,(quantities.get(item.productId)||0)+item.quantity);
    const lines=[];
    for(const [id,qty] of quantities){const p=this.products.find(p=>p.id===id);if(!p)throw new StoreError(404,'PRODUCT_NOT_FOUND','Producto no encontrado');if(p.stock<qty)throw new StoreError(409,'INSUFFICIENT_STOCK','Stock insuficiente');lines.push({productId:id,quantity:qty,unitPrice:p.price,subtotal:p.price*qty});}
    for(const line of lines){const p=this.products.find(p=>p.id===line.productId);const before=p.stock;p.stock-=line.quantity;this.moves.push({productId:p.id,before,after:p.stock,reason:'pedido',date:new Date().toISOString()});}
    const order={id:this.nextOrder++,status:'pendiente',items:lines,total:lines.reduce((s,l)=>s+l.subtotal,0),createdAt:new Date().toISOString()};this.orders.push(order);return structuredClone(order);
  }
  async listOrders(){return structuredClone(this.orders);}
  async changeOrderStatus(id,status){const o=this.orders.find(o=>o.id===id);if(!o)return null;o.status=status;return structuredClone(o);}
  async listMovements(){return structuredClone(this.moves);}
}
class StoreError extends Error {constructor(status,code,message){super(message);this.status=status;this.code=code;}}

class MySQLStore {
  constructor(pool){this.pool=pool;}
  async listProducts(){const [rows]=await this.pool.query('SELECT id, name, price, stock FROM products ORDER BY id');return rows.map(mapProduct);}
  async createProduct(v){const [r]=await this.pool.execute('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)',[v.name,v.price,v.stock]);return {id:r.insertId,...v};}
  async updateStock(id,stock){const c=await this.pool.getConnection();try{await c.beginTransaction();const [[p]]=await c.query('SELECT stock FROM products WHERE id=? FOR UPDATE',[id]);if(!p){await c.rollback();return null;}await c.execute('UPDATE products SET stock=? WHERE id=?',[stock,id]);await c.execute('INSERT INTO stock_movements(product_id, stock_before, stock_after, reason) VALUES (?,?,?,?)',[id,p.stock,stock,'ajuste']);await c.commit();const [[updated]]=await c.query('SELECT id,name,price,stock FROM products WHERE id=?',[id]);return mapProduct(updated);}catch(e){await c.rollback();throw e;}finally{c.release();}}
  async createOrder(items){
    const quantities=new Map();for(const x of items)quantities.set(x.productId,(quantities.get(x.productId)||0)+x.quantity);
    const c=await this.pool.getConnection();
    try{
      await c.beginTransaction();const lines=[];
      // Orden determinista de bloqueos para reducir deadlocks.
      for(const [id,qty] of [...quantities.entries()].sort((a,b)=>a[0]-b[0])){
        const [[p]]=await c.query('SELECT id,price,stock FROM products WHERE id=? FOR UPDATE',[id]);
        if(!p)throw new StoreError(404,'PRODUCT_NOT_FOUND','Producto no encontrado');
        if(p.stock<qty)throw new StoreError(409,'INSUFFICIENT_STOCK','Stock insuficiente');
        lines.push({productId:id,quantity:qty,unitPrice:Number(p.price),subtotal:Number(p.price)*qty,previousStock:p.stock});
      }
      const total=lines.reduce((s,l)=>s+l.subtotal,0);
      const [r]=await c.execute('INSERT INTO orders(status,total) VALUES (?,?)',['pendiente',total]);
      for(const l of lines){await c.execute('UPDATE products SET stock=stock-? WHERE id=?',[l.quantity,l.productId]);await c.execute('INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES (?,?,?,?)',[r.insertId,l.productId,l.quantity,l.unitPrice]);await c.execute('INSERT INTO stock_movements(product_id,stock_before,stock_after,reason,order_id) VALUES (?,?,?,?,?)',[l.productId,l.previousStock,l.previousStock-l.quantity,'pedido',r.insertId]);}
      await c.commit();return {id:r.insertId,status:'pendiente',total,items:lines.map(({previousStock,...l})=>l)};
    }catch(e){await c.rollback();throw e;}finally{c.release();}
  }
  async listOrders(){const [rows]=await this.pool.query('SELECT id,status,total,created_at AS createdAt FROM orders ORDER BY id DESC');return rows.map(x=>({...x,total:Number(x.total)}));}
  async changeOrderStatus(id,status){const [r]=await this.pool.execute('UPDATE orders SET status=? WHERE id=?',[status,id]);if(!r.affectedRows)return null;const [[o]]=await this.pool.query('SELECT id,status,total,created_at AS createdAt FROM orders WHERE id=?',[id]);return {...o,total:Number(o.total)};}
  async listMovements(){const [rows]=await this.pool.query('SELECT id,product_id AS productId,stock_before AS `before`,stock_after AS `after`,reason,created_at AS date FROM stock_movements ORDER BY id DESC LIMIT 100');return rows;}
}
function mapProduct(p){return {...p,price:Number(p.price)};}
async function makeStore(){if(!process.env.DB_HOST)return new MemoryStore();const mysql=require('mysql2/promise');const pool=mysql.createPool({host:process.env.DB_HOST,user:process.env.DB_USER||'minimarket',password:process.env.DB_PASSWORD,database:process.env.DB_NAME||'minimarket',port:3306,waitForConnections:true,connectionLimit:5,ssl:process.env.DB_SSL==='true'?{minVersion:'TLSv1.2'}:undefined});await pool.query('SELECT 1');return new MySQLStore(pool);}
module.exports={MemoryStore,MySQLStore,StoreError,makeStore};
