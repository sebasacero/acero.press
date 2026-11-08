"""Pruebas del cron del mercado: npm run test:api (python3 -m unittest api._acero.test_collect)."""

import unittest
from datetime import date
from unittest.mock import patch

from api._acero import pulse
from api._acero.collect import authorized, config_rows, series_rows
from api._acero.pulse import Bogota, Market, Pulse, Quote

# Así se ve el texto de la portada de la FNC (leído el 8 nov 2026)
FNC_HOME = """Inicio Precio interno de referencia: $2.020.000 por carga de 125 Kg de pergamino seco
Fecha: 2026-11-06 Bolsa de NY: $280 Tasa de cambio: 3.239,50"""


def make(fnc=None, ny=None, trm=None) -> Pulse:
    return Pulse(updatedAt="2026-11-08T17:00:00+00:00", market=Market(fnc=fnc, ny=ny, trm=trm), bogota=Bogota(tempC=14, code=3), status={})


class ParseFnc(unittest.TestCase):
    def test_reads_home_text(self):
        with patch.object(pulse, "today_bogota", return_value=date(2026, 11, 8)):
            got = pulse.parse_fnc_text(FNC_HOME)
        self.assertEqual(got["value"], 2_020_000)
        self.assertEqual(got["date"], "2026-11-06")
        self.assertEqual(got["ny"], 280)
        self.assertEqual(got["trm"], 3239.5)


class Series(unittest.TestCase):
    def test_only_dated_quotes(self):
        p = make(fnc=Quote(value=2_020_000, date="2026-11-06"), ny=Quote(value=280.5, date="2026-11-07"), trm=Quote(value=3237.83, date=None))
        rows = series_rows(p, "t")
        self.assertEqual([(r["metric"], r["day"], r["value"]) for r in rows], [("fnc_carga", "2026-11-06", 2_020_000), ("ny_c", "2026-11-07", 280.5)])
        self.assertTrue(all(r["unit"] and r["source"] for r in rows))

    def test_empty_pulse(self):
        self.assertEqual(series_rows(make(), "t"), [])


class HoyPrice(unittest.TestCase):
    def rows(self, p, cfg):
        return {r["key"]: r["value"] for r in config_rows(p, cfg)}

    def test_first_time(self):
        got = self.rows(make(fnc=Quote(value=2_020_000, date="2026-11-06"), ny=Quote(value=280, date="2026-11-07")), {})
        self.assertEqual(got, {"micra_precio_carga": "2020000", "micra_precio_ny": "2.8", "micra_precio_fecha": "2026-11-06"})

    def test_new_day_moves_previous(self):
        cfg = {"micra_precio_carga": "2050000", "micra_precio_ny": "2.9", "micra_precio_fecha": "2026-11-05"}
        got = self.rows(make(fnc=Quote(value=2_020_000, date="2026-11-06"), ny=Quote(value=281.25, date="2026-11-06")), cfg)
        self.assertEqual(got["micra_precio_carga_ant"], "2050000")
        self.assertEqual(got["micra_precio_ny_ant"], "2.9")
        self.assertEqual(got["micra_precio_ny"], "2.81")

    def test_same_day_keeps_previous(self):
        cfg = {"micra_precio_carga": "2020000", "micra_precio_fecha": "2026-11-06", "micra_precio_carga_ant": "2050000"}
        got = self.rows(make(fnc=Quote(value=2_020_000, date="2026-11-06")), cfg)
        self.assertEqual(got["micra_precio_carga_ant"], "2050000")

    def test_never_overwrites_newer_team_price(self):
        cfg = {"micra_precio_carga": "2100000", "micra_precio_fecha": "2026-11-07"}
        self.assertEqual(config_rows(make(fnc=Quote(value=2_020_000, date="2026-11-06")), cfg), [])

    def test_no_dated_fnc_no_write(self):
        self.assertEqual(config_rows(make(fnc=Quote(value=2_020_000, date=None)), {}), [])

    def test_keeps_team_ny_without_quote(self):
        got = self.rows(make(fnc=Quote(value=2_020_000, date="2026-11-06")), {"micra_precio_ny": "3.1", "micra_precio_fecha": "2026-11-05"})
        self.assertEqual(got["micra_precio_ny"], "3.1")


class Auth(unittest.TestCase):
    def test_needs_secret(self):
        self.assertFalse(authorized("Bearer ", ""))
        self.assertFalse(authorized(None, "s3cret"))
        self.assertFalse(authorized("Bearer otro", "s3cret"))
        self.assertTrue(authorized("Bearer s3cret", "s3cret"))


if __name__ == "__main__":
    unittest.main()
