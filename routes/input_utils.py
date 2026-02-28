"""路由入参解析工具：统一处理空字符串、数字和日期格式。"""

from datetime import datetime


def parse_nullable_int(value, field_name):
    if value is None or value == '':
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{field_name} 必须是整数') from exc


def parse_int(value, field_name, default=None):
    if value is None or value == '':
        if default is not None:
            return default
        raise ValueError(f'{field_name} 不能为空')
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{field_name} 必须是整数') from exc


def parse_float(value, field_name, default=None):
    if value is None or value == '':
        if default is not None:
            return default
        raise ValueError(f'{field_name} 不能为空')
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{field_name} 必须是数字') from exc


def parse_date(value, field_name, required=False):
    if value is None or value == '':
        if required:
            raise ValueError(f'{field_name} 不能为空，格式为 YYYY-MM-DD')
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError as exc:
        raise ValueError(f'{field_name} 日期格式错误，请使用 YYYY-MM-DD') from exc
