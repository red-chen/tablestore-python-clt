#!/usr/bin/env python2.7
# -*- coding:utf-8 -*-

import sys
import json
import argparse
import traceback
import cmd
import csv

from tablestore import *

reload(sys)
sys.setdefaultencoding("utf-8")

GLOBAL_CONF = None
GLOBAL_RUNNING = True

VERSION = "2017-12-12"
GLOBAL_CONFIG_FILE = ".table_store_config"
GLOBAL_HISTORY_FILE = ".history"
GLOBAL_USE_FILE = ".table"
GLOBAL_USE_TABLE = None

def _get_config(path):
    out = {}
    try:
        with open(path) as fp:
            out = json.load(fp)
    finally:
        return out

def _save_config(path, conf):
    with open(path, "w") as fp:
        fp.write(json.dumps(conf, indent=4))

def _handle_config(args):
    global GLOBAL_CONF

    conf = _get_config(GLOBAL_CONFIG_FILE)

    if args.instance:
        conf['instance'] = args.instance
    if args.endpoint:
        conf['endpoint'] = args.endpoint
    if args.accessid:
        conf['accessid'] = args.accessid
    if args.accesskey:
        conf['accesskey'] = args.accesskey
    
    GLOBAL_CONF = conf
    print json.dumps(conf, indent=4)
    _save_config(GLOBAL_CONFIG_FILE, conf)

def _check_config_param(conf, key):
    if not conf.get(key):
        raise Exception("The %s is not exist, please config --%s"%(key, key))

def _get_ots_client():
    global GLOBAL_CONF

    _check_config_param(GLOBAL_CONF, "endpoint")
    _check_config_param(GLOBAL_CONF, "accessid")
    _check_config_param(GLOBAL_CONF, "accesskey")
    _check_config_param(GLOBAL_CONF, "instance")

    return OTSClient(
        "http://" + str(GLOBAL_CONF["endpoint"]),
        str(GLOBAL_CONF["accessid"]),
        str(GLOBAL_CONF["accesskey"]),
        str(GLOBAL_CONF["instance"])
    ) 

def _handle_list_table(args):
    ots = _get_ots_client()
    tables = ots.list_table()
    for t in tables:
        print t

def _handle_get_table(args):
    ots = _get_ots_client()
    describe_response = ots.describe_table(_utf8(args.name))
    print ('TableName: %s' % describe_response.table_meta.table_name)
    print ('PrimaryKey: %s' % describe_response.table_meta.schema_of_primary_key)
    print ('Reserved read throughput: %s' % describe_response.reserved_throughput_details.capacity_unit.read)
    print ('Reserved write throughput: %s' % describe_response.reserved_throughput_details.capacity_unit.write)
    print ('Last increase throughput time: %s' % describe_response.reserved_throughput_details.last_increase_time)
    print ('Last decrease throughput time: %s' % describe_response.reserved_throughput_details.last_decrease_time)
    print ('table options\'s time to live: %s' % describe_response.table_options.time_to_live)
    print ('table options\'s max version: %s' % describe_response.table_options.max_version)
    print ('table options\'s max_time_deviation: %s' % describe_response.table_options.max_time_deviation)

def _handle_use_table(args):
    global GLOBAL_USE_TABLE
    global GLOBAL_USE_TABLE

    ots = _get_ots_client()
    describe_response = ots.describe_table(_utf8(args.name))
    meta = describe_response.table_meta

    out = {
        "table_name" : meta.table_name,
        "pk": meta.schema_of_primary_key,    
    }
    GLOBAL_USE_TABLE = out

    _save_config(GLOBAL_USE_FILE, GLOBAL_USE_TABLE)

def _get_name_and_type(input):
    ss = input.split(":")
    if len(ss) != 2:
        raise Exception("Column format error, expect '{ColumnName}:{Type}'")

    return ss[0], ss[1].upper()

def _get_pk(input):
    items = input.split(",")

    out = []
    for i in items:
        name, type = _get_name_and_type(i)

        out.append((name, type))

    return out

def _utf8(input):
    return str(bytearray(input, "utf-8"))

def _get_table_name():
    global GLOBAL_USE_TABLE
    if not GLOBAL_USE_TABLE:
        raise Exception("Please use table first")

    return GLOBAL_USE_TABLE["table_name"]

def _get_pk_value(input, default=None):
    global GLOBAL_USE_TABLE
    if not GLOBAL_USE_TABLE:
        raise Exception("Please use table first")

    meta = GLOBAL_USE_TABLE["pk"]
    if input:
        items = input.split(",")
        if len(meta) != len(items):
            raise Exception("The count of primary key is %s, but input len is %s"%(len(meta), len(items)))
        out = []
        for i in range(0, len(items)):
            p = meta[i]
            if p[1] == "INTEGER":
                out.append((_utf8(p[0]), int(items[i])))
            elif p[1] == "STRING":
                out.append((_utf8(p[0]), _utf8(items[i])))
            else:
                raise Exception("Not suppert the type(%s)."%(p[1]))

        return out
    else:
        out = []
        for m in meta:
            out.append((_utf8(m[0]), default))
        return out

def _get_pk_value_cvs(items):
    global GLOBAL_USE_TABLE
    if not GLOBAL_USE_TABLE:
        raise Exception("Please use table first")

    meta = GLOBAL_USE_TABLE["pk"]
    if len(meta) > len(items):
        raise Exception("The count of primary key is %s, but input len is %s"%(len(meta), len(items)))
    out = []
    for i in range(0, len(meta)):
       p = meta[i]
       if p[1] == "INTEGER":
           out.append((_utf8(p[0]), int(items[i])))
       elif p[1] == "STRING":
           out.append((_utf8(p[0]), _utf8(items[i])))
       else:
           raise Exception("Not suppert the type(%s)."%(p[1]))
    return out
       
def _get_attr_value(input, with_ts):
    items = input.strip("\n").split(",")
    out = []
    if with_ts:
        for i in items:
            ss = i.split(":")
           
            if len(ss) != 4:
                raise Exception("Format error")

            if ss[1].upper() == "STRING":
                out.append((_utf8(ss[0]), _utf8(ss[2]), int(ss[3])))
            elif ss[1].upper() == "INTEGER":
                out.append((_utf8(ss[0]), int(ss[2]), int(ss[3])))
            elif ss[1].upper() == "DOUBLE":
                out.append((_utf8(ss[0]), float(ss[2]), int(ss[3])))
            else:
                raise Exception("Not suppert the type(%s)"%(ss[1]))
    else:
        for i in items:
            ss = i.split(":")
            
            if len(ss) != 3:
                raise Exception("Format error")

            # TODO
            if ss[1].upper() == "STRING":
                out.append((_utf8(ss[0]), _utf8(ss[2])))
            elif ss[1].upper() == "INTEGER":
                out.append((_utf8(ss[0]), int(ss[2])))
            elif ss[1].upper() == "DOUBLE":
                out.append((_utf8(ss[0]), float(ss[2])))
            else:
                raise Exception("Not suppert the type(%s)"%(ss[1]))

    return out

def _get_ots_data(name, type, str_value):
    if type == "STRING":
        return (_utf8(name), _utf8(str_value))
    elif type == "INTEGER":
        return (_utf8(name), int(str_value))
    elif type == "DOUBLE":
        return (_utf8(name), float(str_value))
    else:
        raise Exception("Not suppert the type(%s)"%(ss[1]))

def _get_attr_value_cvs(items, column):
    global GLOBAL_USE_TABLE
    if not GLOBAL_USE_TABLE:
        raise Exception("Please use table first")

    meta = GLOBAL_USE_TABLE["pk"]
    pk_len = len(meta)
    remain_len = len(items) - pk_len
    columns = column.split(",")
    if len(columns) != remain_len:
        raise Exception("Expect column lenght is %s but count of values is %s" % (len(columns), remain_len))

    out = []
    for i in range(0, remain_len):
        c = columns[i]
        value = items[pk_len + i]
        name, type = _get_name_and_type(c)
        out.append(_get_ots_data(name, type, value))
        
    return out

def _get_pk_and_attr_value(input, with_ts):
    global GLOBAL_USE_TABLE
    if not GLOBAL_USE_TABLE:
        raise Exception("Please use table first")

    meta = GLOBAL_USE_TABLE["pk"]
    items = input.split(" ") 
    if len(items) != 2:
        raise Exception("The line format error")

    pk = _get_pk_value(items[0])
    attr = _get_attr_value(items[1], with_ts)

    return pk, attr

def _get_pk_and_attr_value_cvs(row, column):
    
    pk = _get_pk_value_cvs(row)
    attr = _get_attr_value_cvs(row, column)
    print attr
    return pk, attr

def _get_cu(input):
    items = input.split(",")
    if len(items) != 2:
        raise Exception("Input cu format error, expec '{ReadCU},{WriteCU}'")

    return int(items[0]), int(items[1])

def _handle_create_table(args):
    schema_of_primary_key = _get_pk(args.primary_key)
    table_meta = TableMeta(args.name, schema_of_primary_key)
    table_option = TableOptions(int(args.ttl), int(args.version))
    read, write = _get_cu(args.cu)
    reserved_throughput = ReservedThroughput(CapacityUnit(read,write))
    ots = _get_ots_client()
    ots.create_table(table_meta, table_option, reserved_throughput)
    print "OK"

def _handle_update_table(args):
    table_option = TableOptions(None, None, None)
    if args.ttl:
        table_option.time_to_live = int(args.ttl)
    if args.version:
        table_option.max_version = int(args.version)
    if args.deviation:
        table_option.max_time_deviation = int(args.deviation)

    reserved_throughput = None
    if args.cu:
        read, write = _get_cu(args.cu)
        reserved_throughput = ReservedThroughput(CapacityUnit(read,write))

    ots = _get_ots_client()
    ots.update_table(_utf8(args.name), table_option, reserved_throughput)
    print "OK"

def _handle_delete_table(args):
    ots = _get_ots_client()
    if not args.force:
        table_name = raw_input("re-input name: ")
        if args.name != table_name:
            raise Exception("Re-input table name(%s) not equal name(%s), delete table fail."%(table_name, args.name))
    ots.delete_table(args.name)
    print "OK"

def _handle_put_row(args):
    ots = _get_ots_client()
    
    pk = _get_pk_value(args.primary_key)
    attr = _get_attr_value(args.attribute, False)
    row = Row(pk, attr)
    consumed, return_row = ots.put_row(_get_table_name(), row)
    print "ReadCU:%s, WriteCU:%s"%(consumed.read, consumed.write)
    print "OK"

def _handle_get_row(args):
    ots = _get_ots_client()
    pk = _get_pk_value(args.primary_key)

    columns_to_get = []
    if args.column:
        columns_to_get = args.column.split(",")

    consumed, return_row, next_token = ots.get_row(_get_table_name(), pk, columns_to_get, max_version = int(args.version))
    print "PrimaryKey:%s"%(str(return_row.primary_key))
    print "Attribute:%s"%(str(return_row.attribute_columns))
    print "ReadCU:%s, WriteCU:%s"%(consumed.read, consumed.write)
    print "OK"

def _get_range(args):
    ots = _get_ots_client()

    direction = Direction.FORWARD
    if args.direction.upper() == "BACKWARD":
        begin_pk = _get_pk_value(args.begin, INF_MAX)
        end_pk = _get_pk_value(args.end, INF_MIN)
        direction = Direction.BACKWARD
    else:
        begin_pk = _get_pk_value(args.begin, INF_MIN)
        end_pk = _get_pk_value(args.end, INF_MAX)

    column_to_get = []
    if args.column:
        column_to_get = args.column.split(',')

    top = None
    if args.limit:
        top = int(args.limit)

    consumed_counter = CapacityUnit(0, 0)
    token = ots.xget_range(
        _get_table_name(),
        direction,
        begin_pk,
        end_pk,
        consumed_counter,
        column_to_get,
        count = top,
        max_version = int(args.version)
    )
    return token, consumed_counter

def _handle_get_range(args):
    token, consumed_counter = _get_range(args)

    count = 0
    for r in token:
        count = count + 1
        if count % int(args.pagesize) == 0:
            if args.interval:
                time.sleep(float(args.interval))

        print "%s, %s" %(r.primary_key, r.attribute_columns)

    print "OK, CU: (%s, %s), Count: %s"%(consumed_counter.read, consumed_counter.write, count)

def _handle_import(args):
    ots = _get_ots_client()

    with open(args.file) as fp:
        while True:
            line = fp.readline()
            if not line:
                break

            pk, attr = _get_pk_and_attr_value(line, args.with_ts)
            row = Row(pk, attr)
            consumed, return_row = ots.put_row(_get_table_name(), row)
            print "ReadCU:%s, WriteCU:%s"%(consumed.read, consumed.write)

        print "OK"

def _handle_import_cvs(args):
    ots = _get_ots_client()

    with open(args.file) as fp:
        reader = csv.reader(fp, delimiter=args.delimiter, quotechar=args.quotechar)
        for row in reader:
            pk, attr = _get_pk_and_attr_value_cvs(row, args.column)
            row = Row(pk, attr)
            consumed, return_row = ots.put_row(_get_table_name(), row)
            print "ReadCU:%s, WriteCU:%s"%(consumed.read, consumed.write)

        print "OK"

def _dump_pk(pk):
    out = []
    for p in pk:
        out.append(p[1])

    return ','.join(out)

def _get_type(v):
    if isinstance(v, int):
        return "INTEGER"
    elif isinstance(v, str):
        return "STRING"
    elif isinstance(v, float):
        return "DOUBLE"
    else:
        return "UnSupport"

def _dump_attr(attr, with_ts=False):
    out = []
    if with_ts:
        for a in attr:
            out.append("%s:%s:%s:%s"%(a[0], _get_type(a[1]), a[1], a[2]))
    else:
        for a in attr:
            out.append("%s:%s:%s"%(a[0], _get_type(a[1]), a[1]))
    return ','.join(out)

def _handle_export(args):
    token, consumed_counter = _get_range(args)

    count = 0

    with open(args.file, "w") as fp:
        for r in token:
            count = count + 1
            fp.write("%s %s\n"%(_dump_pk(r.primary_key), _dump_attr(r.attribute_columns, args.with_ts)))

    print "OK, CU: (%s, %s), Count: %s"%(consumed_counter.read, consumed_counter.write, count)

def gen_sub_parser():
    parser = argparse.ArgumentParser()

    subs = parser.add_subparsers(title="Sub Commands")

    # config
    sub_config = subs.add_parser('config', help="config the tablestore.")
    sub_config.add_argument("--instance", dest="instance", help="tablestore instance name")
    sub_config.add_argument("--endpoint", dest="endpoint", help="tablestore endpoint")
    sub_config.add_argument("--accessid", dest="accessid", help="tablestore accessid")
    sub_config.add_argument("--accesskey", dest="accesskey", help="tablestore accesskey")
    sub_config.set_defaults(func=_handle_config)

    # create table
    sub_ct = subs.add_parser('ct', help="create table.")
    sub_ct.add_argument("-n", "--name", dest="name", required=True, help="table name")
    sub_ct.add_argument("--primary_key", dest="primary_key", required=True, 
                   help="primary key. format: {ColumnName}:{Type}, type: STRING,INTEGER")
    sub_ct.add_argument("--cu", dest="cu", default="0,0", help="reserved capacity unit, defaut: 0,0")
    sub_ct.add_argument("--ttl", dest="ttl", default="-1", help="time to live")
    sub_ct.add_argument("--version", dest="version", default="1", help="max version")
    sub_ct.add_argument("--deviation", dest="deviation", default="86400", help="max time deviation")
    sub_ct.set_defaults(func=_handle_create_table)
    sub_ct = subs.add_parser('create_table', help="create table.")
    sub_ct.add_argument("-n", "--name", dest="name", required=True, help="table name")
    sub_ct.add_argument("--primary_key", dest="primary_key", required=True, 
                   help="primary key. format: {ColumnName}:{Type}, type: STRING,INTEGER")
    sub_ct.add_argument("--cu", dest="cu", default="0,0", help="reserved capacity unit, defaut: 0,0")
    sub_ct.add_argument("--ttl", dest="ttl", default="-1", help="time to live")
    sub_ct.add_argument("--version", dest="version", default="1", help="max version")
    sub_ct.add_argument("--deviation", dest="deviation", default="86400", help="max time deviation")
    sub_ct.set_defaults(func=_handle_create_table)

    # update table
    sub_ut = subs.add_parser('ut', help="update table meta.")
    sub_ut.add_argument("-n", "--name", dest="name", required=True, help="table name")
    sub_ut.add_argument("--cu", dest="cu", help="reserved capacity unit")
    sub_ut.add_argument("--ttl", dest="ttl", help="time to live")
    sub_ut.add_argument("--version", dest="version", help="max version")
    sub_ut.add_argument("--deviation", dest="deviation", help="max time deviation")
    sub_ut.set_defaults(func=_handle_update_table)
    sub_ut = subs.add_parser('update_table', help="update table meta.")
    sub_ut.add_argument("-n", "--name", dest="name", required=True, help="table name")
    sub_ut.add_argument("--cu", dest="cu", help="reserved capacity unit")
    sub_ut.add_argument("--ttl", dest="ttl", help="time to live")
    sub_ut.add_argument("--version", dest="version", help="max version")
    sub_ut.add_argument("--deviation", dest="deviation", help="max time deviation")
    sub_ut.set_defaults(func=_handle_update_table)

    # delete table
    sub_dt = subs.add_parser('dt', help="delete table.")
    sub_dt.add_argument("-n", "--name", dest="name", required=True, help="table name")
    sub_dt.add_argument("-f", "--force", dest="force", action='store_true', help="force delete table")
    sub_dt.set_defaults(func=_handle_delete_table)
    sub_dt = subs.add_parser('delete_table', help="delete table.")
    sub_dt.add_argument("-n", "--name", dest="name", required=True, help="table name")
    sub_dt.add_argument("-f", "--force", dest="force", action='store_true', help="force delete table")
    sub_dt.set_defaults(func=_handle_delete_table)

    # list table
    sub_lt = subs.add_parser('lt', help="list table name.")
    sub_lt.set_defaults(func=_handle_list_table)
    sub_lt = subs.add_parser('list_table', help="list table name.")
    sub_lt.set_defaults(func=_handle_list_table)

    # get table
    sub_gt = subs.add_parser('gt', help="get table meta.")
    sub_gt.add_argument("-n", "--name", dest="name", required=True, help="table name")
    sub_gt.set_defaults(func=_handle_get_table)
    sub_gt = subs.add_parser('get_table', help="get table meta.")
    sub_gt.add_argument("-n", "--name", dest="name", required=True, help="table name")
    sub_gt.set_defaults(func=_handle_get_table)

    # use table
    sub_use = subs.add_parser('use', help="use table")
    sub_use.add_argument("-n", "--name", dest="name", required=True, help="table name")
    sub_use.set_defaults(func=_handle_use_table)

    # put row
    sub_pr = subs.add_parser('pr', help="put a row")
    sub_pr.add_argument("-p", "--primary_key", dest="primary_key", required=True, help="primary key, format: {v1},{v2},...")
    sub_pr.add_argument("-a", "--attribute", dest="attribute", required=True, help="attribute column, type: STRING,INTEGER,DOUBLE. format: {c1_name}:{c1_type}:{c1_value},...")
    sub_pr.set_defaults(func=_handle_put_row)
    sub_pr = subs.add_parser('put_row', help="put a row")
    sub_pr.add_argument("-p", "--primary_key", dest="primary_key", required=True, help="primary key, format: {v1},{v2},...")
    sub_pr.add_argument("-a", "--attribute", dest="attribute", required=True, help="attribute column, type: STRING,INTEGER,DOUBLE.format: {c1_name}:{c1_type}:{c1_value},...")
    sub_pr.set_defaults(func=_handle_put_row)

    # get row
    sub_pr = subs.add_parser('gr', help="get a row")
    sub_pr.add_argument("-p", "--primary_key", dest="primary_key", required=True, help="primary key")
    sub_pr.add_argument("-v", "--version", dest="version", default="1", help="max version")
    sub_pr.add_argument("-c", "--column", dest="column", help="return columns.")
    sub_pr.set_defaults(func=_handle_get_row)
    sub_pr = subs.add_parser('get_row', help="get a row")
    sub_pr.add_argument("-p", "--primary_key", dest="primary_key", required=True, help="primary key")
    sub_pr.add_argument("-v", "--version", dest="version", default="1", help="max version")
    sub_pr.add_argument("-c", "--column", dest="column", help="return columns.")
    sub_pr.set_defaults(func=_handle_get_row)


    # scan
    sub_pr = subs.add_parser('scan', help="scan the specify range data.")
    sub_pr.add_argument("--begin", dest="begin", help="begin primary key")
    sub_pr.add_argument("--end", dest="end", help="end primary key")
    sub_pr.add_argument("--limit", dest="limit", help="count of return rows.")
    sub_pr.add_argument("--version", dest="version", default="1", help="max version")
    sub_pr.add_argument("--column", dest="column", help="return columns")
    sub_pr.add_argument("--direction", dest="direction", default="FORWARD", help="FORWARD|BACKWARD, default: FORWARD")

    sub_pr.add_argument("--pagesize", dest="pagesize", default=100, help="default show page size")
    sub_pr.add_argument("--interval", dest="interval", default=0, help="default show interval")
    sub_pr.set_defaults(func=_handle_get_range)

    # import 
    sub_import = subs.add_parser('import', help="import data of file to tablestore")
    sub_import.add_argument("--file", dest="file", required=True, help="import data file,  row format: '{PrimaryKeyValues}, {Name}:{Type}:{Value},'")
    sub_import.add_argument("--with_ts", dest="with_ts", action="store_true", help="with timestamp in attribute")
    sub_import.set_defaults(func=_handle_import)

    # export 
    sub_export = subs.add_parser('export', help="export data of tablestore to file")
    sub_export.add_argument("--file", dest="file", required=True, help="export data file")
    sub_export.add_argument("--begin", dest="begin", help="begin primary key")
    sub_export.add_argument("--end", dest="end", help="end primary key")
    sub_export.add_argument("--limit", dest="limit", help="count of return rows.")
    sub_export.add_argument("--version", dest="version", default="1", help="max version")
    sub_export.add_argument("--column", dest="column", help="return columns")
    sub_export.add_argument("--direction", dest="direction", default="FORWARD", help="FORWARD|BACKWARD, default: FORWARD")
    sub_export.add_argument("--with_ts", dest="with_ts", action="store_true", help="show timestamp")
    sub_export.set_defaults(func=_handle_export)

    # import cvs 
    sub_import_cvs = subs.add_parser('import_cvs', help="import cvs data of file to tablestore")
    sub_import_cvs.add_argument("--file", dest="file", required=True, help="import data file,  row format: '{V1},{V2},{V3},....'")
    sub_import_cvs.add_argument("--column", dest="column", required=True, help="attribute column, format: '{Name}:{Type},{Name}:{Type},...'")
    sub_import_cvs.add_argument("--delimiter", dest="delimiter", default=",", help="delimiter, default:','")
    sub_import_cvs.add_argument("--quotechar", dest="quotechar", default='"', help="quotechar, default:'\"'")
    sub_import_cvs.set_defaults(func=_handle_import_cvs)

    return parser

class InteractiveCmd(cmd.Cmd):
    prompt = "tablestore@%s> "%(GLOBAL_USE_TABLE) if GLOBAL_USE_TABLE else "tablestore> "
    def _load_cmd(self):
        try:
            with open(GLOBAL_HISTORY_FILE) as fp:
                return json.load(fp)
        except Exception, e:
            return []

    def _save_cmd(self):
        try:
            with open(GLOBAL_HISTORY_FILE, "w") as fp:
                length = len(self.cmds)
                if length > 50:
                    fp.write(json.dumps(self.cmds[length - 50:length], indent=4))
                else:
                    fp.write(json.dumps(self.cmds, indent=4))

        except Exception, e:
            pass
  
    def set_prompt(self):
        global GLOBAL_USE_TABLE
        if GLOBAL_USE_TABLE:
            self.prompt = 'tablestore@%s> '%(GLOBAL_USE_TABLE["table_name"])
        else:
            self.prompt = 'tablestore> '
    
    def init(self, parser, args):
        self.cmds = self._load_cmd()
        self.parser = parser
        self.args = args
        self.set_prompt()
        return self

    def do_cmds(self, line):
        for c in self.cmds:
            print c

    def do_quit(self, line):
        global GLOBAL_RUNNING
        GLOBAL_RUNNING = False
        print "Bye"
        sys.exit(0)

    def do_help(self, line):
        self.parser.print_help()

    def default(self, line):
        if not line:
            return
        self.cmds.append(line)
        self._save_cmd()

        argv = line.split(' ')
        result = self.parser.parse_args(argv)
        result.func(result)

        self.set_prompt()

# 命令模式 
def command_mode(parser, args):
    argv = args.cmd.split(' ')
    result = parser.parse_args(argv)
    result.func(result)

def _handle_mode(args):
    global GLOBAL_CONF
    global GLOBAL_USE_TABLE
    global GLOBAL_RUNNING

    GLOBAL_CONF = _get_config(GLOBAL_CONFIG_FILE)
    GLOBAL_USE_TABLE = _get_config(GLOBAL_USE_FILE)

    sub_parser = gen_sub_parser()
    if args.cmd:
        command_mode(sub_parser, args)
    else:
        print "Aliyun TableStore Command Line Tool. Version %s." % (VERSION)
        while GLOBAL_RUNNING:
            try:
                InteractiveCmd().init(sub_parser, args).cmdloop()
            except SystemExit, e:
                pass
            except Exception,e:
                # debug
                traceback.print_exc()
                print str(e)

def gen_mode_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", dest="cmd", help="command mode.")
    parser.set_defaults(func=_handle_mode)
    return parser

if __name__ == '__main__':
    parser = gen_mode_parser()
    result = parser.parse_args(sys.argv[1:])
    result.func(result)


