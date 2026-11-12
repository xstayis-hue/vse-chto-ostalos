"""Станция-призрак для «Всё, что от меня ОСТАЛОСЬ»: модуль, две панели и антенна.
Запуск: python station.py  -> station.glb рядом с файлом."""
import os

import sand3d as s3d


def station():
    core = s3d.extrude("core", s3d.circle(6), 18)
    s3d.fillet(core, 0.6, edges="top")
    panel_l = s3d.extrude("panel_l", s3d.rect(14, 1.2, r=0.2), 6)
    panel_r = s3d.extrude("panel_r", s3d.rect(14, 1.2, r=0.2), 6)
    antenna = s3d.extrude("antenna", s3d.circle(0.5), 10)
    return s3d.group("station", core, panel_l, panel_r, antenna)


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "station.glb")
    s3d.export(station(), out)
    print("OK:", out)
