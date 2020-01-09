const express =require("express");
const app=express();
const bodyParser=require("body-parser");
const db = require("./module/db");
const tools = require("./module/tools");
const fs=require("fs");
const formidable = require("formidable");
const mongodb = require("mongodb");
const {upPic} = require("./module/upPic");
app.use(bodyParser.json());
app.use(express.static(__dirname+"/upload"));
app.all("*",function(req,res,next){
    //设置允许跨域的域名，*代表允许任意域名跨域
    res.header("Access-Control-Allow-Origin","*");
    //允许的header类型
    res.header("Access-Control-Allow-Headers","*");
    //跨域允许的请求方式
    res.header("Access-Control-Allow-Methods","DELETE,PUT,POST,GET,OPTIONS");
    next();
});
app.post("/login1",(req,res)=>{
    const {account,password,ip,location}= req.body;
    db.findOne("userList",{
        account,
        password:tools.md5(password)
    }).then(async(userInfo)=>{
        if(userInfo){
            await db.updateOne("userList",{
                _id:userInfo._id
            },{
                $set:{
                    loginTime:Date.now()
                }
            });
            await db.insertOne("userLog",{
                accountId:userInfo._id,
                account:userInfo.account,
               // ip,location,
                loginTime:Date.now()
            });
            const token=tools.enToken({
                account
            });

            res.json({
                code:200,
                msg:"登录成功",
                account,
                token,
                accountId:userInfo._id
            })
        }else{
            res.json({
                code:-1,
                msg:"账号或密码错误"
            })
        }
    }).catch(()=>{
        res.json({msg:"服务异常，稍后再试"});
    })
});
app.post("/login",(req,res)=>{
    const {account,password,ip,location}= req.body;
    db.findOr("userList",{$or:[
        {
            account,
            password:tools.md5(password)
        }, {
                email:account,
                password:tools.md5(password)
            },{
                phoneNumber:account,
                password:tools.md5(password)
            }
        ]}).then(async (userInfo)=>{
        if(userInfo.length>0){
            await db.updateOne("userList",{
                _id:userInfo._id
            },{
                $set:{
                    loginTime:Date.now()
                }
            });
            await db.insertOne("userLog",{
                accountId:userInfo._id,
                account:userInfo.account,
                // ip,location,
                createTime:Date.now()
            });
            const Authorization=tools.enToken({
                account
            });
            res.json({
                code:200,
                msg:"登录成功",
                account:userInfo[0].account,
                Authorization,
                accountId:userInfo[0]._id
            })
        }else{
            res.json({
                code:-1,
                msg:"账号或密码错误"
            })
        }
    }).catch((err)=>{
        res.json({msg:"服务异常，稍后再试"});
    })
});
app.post("/register", function (req,res) {
    const {account,password,email,ip,location}= req.body;
    db.findOne("userList",{
        account
    }).then(data=>{
        if(data){
            res.json({
                code:-1,
                msg:"账号已注册"
            });
        }else{
            db.insertOne("userList",{
                account,
                password:tools.md5(password),
                email,
                registerTime:Date.now()
            });
            res.json({
                code:200,
                msg:"注册成功"
            })
        }
    })
});
app.post("/swiper",async (req,res)=>{
    const {newPicName,params,msg} = await upPic(req,"pic");
    db.insertOne("swiperList",{
        swiperImg:newPicName,
     //   swiperUser:params.user || ""
    });
    res.json({
        code:200,
        msg
    })
});
app.get("/swiperList",async (req,res)=>{
   const swiperList=await db.find("swiperList",{});
    res.json({
        code:200,
        msg:"查询成功",
        swiperList
    })
});
app.delete("/delSwiper",async (req,res)=>{
    const id=req.query.id;
    console.log(id)
    const info =await db.findOneById("swiperList",id);
    fs.unlink(__dirname+"/upload/"+info.swiperImg,async function (err) {
        if(err){
            res.json({
                code:-1,
                msg:"删除失败"
            })
        }else{
            await db.deleteOneById("swiperList",info._id).then((data)=>{
                res.json({
                    code:200,
                    msg:"删除成功"
                });
            }).catch((err)=>res.json({code:-1,msg:"删除失败"}));
        }
    })
});
app.get("/findFriends",async (req,res)=>{
    const {account}=req.query;
    console.log(account)
   db.findOne("userList",{
        account
    }).then((userInfo)=>{
       if(userInfo){
           res.json({
               code:200,
               msg:"查找成功",
               friend:userInfo.account
           })
       }else {
           res.json({
               code:-1,
               msg:"没有查询到此账号",
               friend:null
           })
       }
   })

});
app.get("/addFriends",async (req,res)=>{
    const {account,friend}=req.query;
    db.findOne(account,{
        name:friend
    }).then((userInfo)=>{
        if(userInfo){
            res.json({
                code:-1,
                msg:"不能重复添加好友",
            })
        }else {
            db.insertOne(account,{
                name:friend,
                createTime: Date.now()
            }).then((userInfo)=>{
                if(userInfo.results?userInfo.results.ok===1 && userInfo.results.n===1:null){
                    res.json({
                        code:200,
                        msg:"添加好友成功",
                    })
                }else {
                    res.json({
                        code:-1,
                        msg:"添加好友失败",
                        friend:null
                    })
                }
            })
        }
    })


});
app.get("/Authorization",(req,res)=>{
    const key=req.query;
    const Authorization=tools.enToken({
        key
    });
    res.json({
       code:200,
        Authorization
    })
});
app.get("/friendList",async (req,res)=>{
    const {account}=req.query;
    const list = await db.find(account,{});
    res.json({
        code:200,
        list,
        msg:"userList"
    })
});
app.get("/list",async (req,res)=>{
    const list = await db.find("userList",{});
    res.json({
        code:200,
        list,
        msg:"userList"
    })
});
app.all("*",function (req,res,next) {
    const {ok,msg}=tools.deToken(req.headers.authorization);
    if(ok==1){
        next();
    }else{
        res.json({
            ok,msg
        })
    }
});
app.delete("/logoff",(req,res)=>{
    const id=req.query.id;
    db.deleteOneById("userList",id).then((info)=>{
        res.json({
            code:200,
            msg:"注销账号成功"
        });
    })
});
app.listen(8088,()=>{
    console.log("端口:8088" +
        "启动:success"
    )
});