
# 表格存储Command Line Tool (Python)
>VERSION : 2017-11-05

# SDK安装
>需要先安装Python SDK，方式如下

### PIP 安装
```
pip install tablestore
```

### GitHub安装
```
git clone https://github.com/aliyun/aliyun-tablestore-python-sdk.git
python setup.py install
```

### 源码安装
```
python setup.py install
```

# 使用样例
```
1. 安装SDK
2. 下载Clt工具
3. 启动 "./ts"
4. 配置账户接入
tablestore> config --endpoint myinstance.cn-hangzhou.ots.aliyuncs.com --instance myinstance --accessid test_accessid --accesskey test_accesskey

5. 创建表
tablestore> ct --name mytable --primary_key uid:string,pid:integer

6. 遍历表
tablestore> lt

7. 管理表，表必须被关联才能进行数据的读写
tablestore> use --name mytable

关联之后
tablestore@mytable>

8. 写入两行数据
tablestore@mytable> pr --primary_key redchen,0 --attribute name:string:redchen,address:string:china,weight:integer:70
tablestore@mytable> pr --primary_key redchen,1 --attribute name:string:redchen,address:string:china,weight:integer:70

9. 读取这行数据
tablestore@mytable> gr --primary_key redchen,0

10. 遍历整张表
tablestore@mytable> scan

11. 导出数据到本地
tablestore@mytable > export --file mytable.data

12. 加载本地的数据
tablestore@mytable> import --file mytable.data

13. 退出
tablestore@mytable> quit

```

# 命令
- help
- config
- create_table(ct)
- delete_table(dt)
- list_table(lt)
- get_table(gt)
- update_table(ut)
- use
- get_row(gr)
- put_row(pr)
- scan
- import
- export
- quit

# 非交互模式
```
./ts -c "";
./ts;
```

# 命令：config
> 用户配置

`参数详解：`
 
```
config 
    --endpoint "{endpoint}"
    --accessid "{access_id}"
    --accesskey "{access_key}"
    --instance "{instance_name}"
```

`样例：`

```
# 查看配置信息
config 

# 配置接入信息
config --endpoint {TABLESTORE-ENDPOINT} --instance {INSTANCE}
```

# 命令：create_table(ct)
> 创建表

`参数详解：`
 
```
ct 
    --name {table_name}       # 必须
    --primary_key {primary_key} # 必须
    
    --cu {read_cu},{write_cu} # 可选，默认为0,0
    --ttl {time_to_live}      # 可选，默认为-1
    --version {max_verison}   # 可选，默认为1
    --deviation {max_time_deviation} # 可选，默认是86400
```

`样例：`

```
# 创建一张表，mytable
ct --name mytable --primary_key uid:string,pid:integer
```

# 命令：delete_table(dt)
> 删除指定的表

`参数详解：`
 
```
dt
    --name {table_name} 
    --force
```

`样例：`

```
# 删除mytable
dt --name mytable --force
```

# 命令：list_table(lt)
> 遍历表名

`参数详解：`
 
```
lt
```

`样例：`

```
```

# 命令：get_table(gt)
> 获取表的设置信息

`参数详解：`
 
```
gt
    --name {table_name}       
```

`样例：`

```
```

# 命令：update_table(ut)
> 修改表的设置信息

`参数详解：`
 
```
ut 
    --name {table_name}       # 必须
    --cu {read_cu},{write_cu} # 可选
    --ttl {time_to_live}      # 可选
    --version {max_verison}   # 可选
    --deviation {max_time_deviation} # 可选
```

`样例：`

```
```

# 命令：use
> 关联表，后面所有的数据操作都需要关联表

`参数详解：`
 
```
use 
    --name {table_name}       # 必须
```

`样例：`

```
```



# 命令：put_row(pr)
> 写入一行数据

`参数详解：`
 
```
pr
    --primary_key
    --attribute 
    
    primary_key {value1},{value2},...
        
    attribute {column name}:{type}:{value},
        type: string,integer
```

`样例：`

```
pr --primary_key redchen --attribute name:string:redchen,address:string:china,weight:integer:70
```

# 命令：get_row(gr)
> 获取指定的一行数据

`参数详解：`
 
```
gr
    --primary_key
    --version
    --columns
    
    primary_key {column name},
    columns {column name},
    
```

`样例：`

```
gr --primary_key redchen --column name,weight
```

# 命令：scan
> 顺序遍历数据

`参数详解：`
 
```
scan 
    --begin
    --end
    --version
    --column
    --limit
    --direction
    
    direction
        FORARD, BACKWARD
```

`样例：`

```
```

# 命令：import
> 将本地数据导入

`参数详解：`
 
```
import 
    --file 

    --with_ts
    
    导入支持两种模式，第一种是不带时间戳，第二种是带时间戳
```

`样例：`

```
#本地文件样式一
import --file mytable.data
uid0 attr00:string:attr00_v,attr01:string:attr01_v,attr02:int:attr02_v  

#本地文件样式二
import --file mytable.data  --with_ts
uid0 attr00:string:attr00_v:153009123,attr01:string:attr01_v:153009123,attr02:integer:attr02_v:153009123
```

# 命令：export
> 将数据下载到本地

`参数详解：`
 
```
export
    --file 
    --begin
    --end
    --version
    --column
    --limit
    --direction
    --with_ts
```

`样例：`

```
export 
export --with_ts
```
