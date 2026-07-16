const fs=require('fs'),path=require('path'),AdmZip=require('adm-zip');
const root=path.resolve(__dirname,'..'), src=path.join(root,'dist-standalone'), out=path.join(root,'app-2.2.2-ce.zip');
const z=new AdmZip();
function walk(dir,rel=''){let es;try{es=fs.readdirSync(dir,{withFileTypes:true})}catch{return}for(const e of es){const a=path.join(dir,e.name),r=path.join(rel,e.name).replace(/\\/g,'/');if(e.isDirectory())walk(a,r);else if(e.isFile()&&!r.includes('node_modules/next/dist/client/components/react-dev-overlay')){try{z.addLocalFile(a,path.posix.dirname(r)==='.'?'':path.posix.dirname(r))}catch{}}}}
walk(src);
// Electron loads its main process from this folder. It must travel with the
// app payload because the updater replaces resources\app only.
walk(path.join(root,'electron'),'electron');
z.writeZip(out); console.log(out);
