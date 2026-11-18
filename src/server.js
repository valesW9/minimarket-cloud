'use strict';
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const {makeStore,StoreError}=require('./store');
const MAX_BODY=1024*64;const PUBLIC=path.join(__dirname,'..','public');
function error(status,code,message){return new StoreError(status,code,message);}
function parseId(v){const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw error(400,'BAD_ID','Identificador invalido');return n;}
function checkProduct(b){if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>120||!Number.isSafeInteger(b.price)||b.price<0||!Number.isSafeInteger(b.stock)||b.stock<0)throw error(400,'BAD_PRODUCT','Nombre, precio y stock invalidos');return {name:b.name.trim(),price:b.price,stock:b.stock};}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function getBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',d=>{s+=d;if(s.length>MAX_BODY){reject(error(413,'TOO_LARGE','Solicitud demasiado grande'));req.destroy();}});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch{reject(error(400,'BAD_JSON','JSON invalido'));}});req.on('error',reject);});}
function authorized(req){const expected=process.env.ADMIN_TOKEN;if(!expected)return false;const h=req.headers.authorization||'';const token=h.startsWith('Bearer ')?h.slice(7):'';if(token.length!==expected.length||!token)return false;return require('node:crypto').timingSafeEqual(Buffer.from(token),Buffer.from(expected));}
function requireAdmin(req){if(!authorized(req))throw error(401,'UNAUTHORIZED','Se necesita token de administrador');}
function createHandler(store){return async(req,res)=>{
 const start=Date.now();try{
 const url=new URL(req.url,'http://localhost');const p=url.pathname;
 if(req.method==='GET'&&p==='/health'){json(res,200,{status:'ok',service:'minimarket-cloud'});return;}
 if(req.method==='GET'&&p==='/api/products'){json(res,200,await store.listProducts());return;}
 if(req.method==='POST'&&p==='/api/products'){requireAdmin(req);json(res,201,await store.createProduct(checkProduct(await getBody(req))));return;}
 const stockMatch=p.match(/^\/api\/products\/(\d+)\/stock$/);
 if(req.method==='PATCH'&&stockMatch){requireAdmin(req);const b=await getBody(req);if(!Number.isSafeInteger(b.stock)||b.stock<0)throw error(400,'BAD_STOCK','Stock invalido');const result=await store.updateStock(parseId(stockMatch[1]),b.stock);if(!result)throw error(404,'NOT_FOUND','Producto no encontrado');json(res,200,result);return;}
 if(req.method==='POST'&&p==='/api/orders'){
 const b=await getBody(req);if(!b||!Array.isArray(b.items)||b.items.length===0||b.items.length>30||!b.items.every(x=>Number.isSafeInteger(x.productId)&&x.productId>0&&Number.isSafeInteger(x.quantity)&&x.quantity>0&&x.quantity<=1000))throw error(400,'BAD_ORDER','El pedido debe contener productos y cantidades validas');json(res,201,await store.createOrder(b.items));return;
 }
 if(req.method==='GET'&&p==='/api/orders'){requireAdmin(req);json(res,200,await store.listOrders());return;}
 if(req.method==='GET'&&p==='/api/movements'){requireAdmin(req);json(res,200,await store.listMovements());return;}
 const orderMatch=p.match(/^\/api\/orders\/(\d+)\/status$/);
 if(req.method==='PATCH'&&orderMatch){requireAdmin(req);const b=await getBody(req);if(!['pendiente','en_preparacion','completado'].includes(b.status))throw error(400,'BAD_STATUS','Estado invalido');const result=await store.changeOrderStatus(parseId(orderMatch[1]),b.status);if(!result)throw error(404,'NOT_FOUND','Pedido no encontrado');json(res,200,result);return;}
 if(req.method==='GET'&&['/','/admin','/styles.css','/app.js'].includes(p)){
 const f=p==='/'?'index.html':p==='/admin'?'admin.html':p.slice(1);const type=f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/javascript; charset=utf-8';res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'"});fs.createReadStream(path.join(PUBLIC,f)).pipe(res);return;
 }
 json(res,404,{error:'NOT_FOUND',message:'Ruta no encontrada'});
 }catch(e){const status=e.status||500;console.error(JSON.stringify({event:'request_error',method:req.method,path:req.url,status,code:e.code||'INTERNAL',durationMs:Date.now()-start}));if(!res.headersSent)json(res,status,{error:e.code||'INTERNAL',message:status===500?'Error interno':e.message});}
 };}
if(require.main===module){makeStore().then(store=>{const port=Number(process.env.PORT)||3000;http.createServer(createHandler(store)).listen(port,'0.0.0.0',()=>console.log(JSON.stringify({event:'server_ready',port,database:process.env.DB_HOST?'mysql':'demo'})));}).catch(e=>{console.error('No se pudo conectar a la base de datos:',e.message);process.exit(1);});}
module.exports={createHandler};
