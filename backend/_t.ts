import { parseListing } from "./src/import/dinamalar";
(async()=>{for(const [path,u] of [["/news/business","https://www.dinamalar.com/news/business"],["/news/sports","https://www.dinamalar.com/news/sports"],["/news/tamil-nadu-district-news-coimbatore","https://www.dinamalar.com/news/tamil-nadu-district-news-coimbatore"]]){
const h=await (await fetch(u,{headers:{"user-agent":"Mozilla/5.0"}})).text();const l=parseListing(h,path);console.log(path,l.length,l.slice(0,2).map(x=>x.slice(-50)));}})();
