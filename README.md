# Dashboard v2 獨立部署包

一個独立的 FastAPI 服务，用于托管加密货币交易 Dashboard v2。

## 目录结构

```
dashboard_v2_standalone/
├── server.py          # FastAPI 服务主文件
├── dashboard_v2.html  # Dashboard 前端页面
├── requirements.txt   # Python 依赖
├── run.sh            # 启动脚本
└── README.md         # 本文件
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
./run.sh
# 或手动启动
python3 -m uvicorn server:app --host 0.0.0.0 --port 5006
```

### 3. 访问 Dashboard

- 打开浏览器访问：http://localhost:5006/dashboard_v2

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 重定向到 `/dashboard_v2` |
| `/dashboard_v2` | GET | 返回 Dashboard HTML 页面 |
| `/api/klines` | GET | 获取 Binance K线数据 |
| `/api/strategies/all` | GET | 获取所有策略 |
| `/api/strategies/live` | GET | 获取活跃策略 |
| `/api/dashboard/anomalies` | GET | 获取异常数据 |

### API 参数

#### `/api/klines`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 交易对，如 `BTCUSDT` |
| interval | string | 是 | K线周期，如 `1m`, `5m`, `1h`, `1d` |
| limit | int | 否 | 数据条数，默认 300 |

## 技术栈

- **后端**: FastAPI + Uvicorn
- **前端**: 原生 HTML/CSS/JavaScript
- **数据源**: Binance API

## 配置

默认端口：`5006`

如需修改端口，编辑 `run.sh` 或使用命令行参数：

```bash
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000
```
