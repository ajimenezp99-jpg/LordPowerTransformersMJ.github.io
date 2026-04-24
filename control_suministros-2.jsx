import React, { useState, useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { ClipboardList, Package, Target, TrendingUp, Cpu, Zap, AlertTriangle, FileCheck, Box, AlertCircle, DollarSign } from 'lucide-react';

const TRANSFORMADORES = [
  {m:"T1-M/M-ABA",sub:"AGUAS BLANCAS",zona:"ORIENTE",dep:"CESAR",cod:20026566,ser:64999953,pot:2000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-A/M-AGB",sub:"ALGARROBO",zona:"ORIENTE",dep:"MAGDALENA",cod:20026576,ser:"1LCB393904",pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-ANB",sub:"ANIMAS BAJAS",zona:"BOLIVAR",dep:"BOLIVAR",cod:20016578,ser:71842703,pot:500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-ARN",sub:"ARIGUANI",zona:"ORIENTE",dep:"MAGDALENA",cod:20700074,ser:71145953,pot:2000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-ARJ",sub:"ARJONA",zona:"ORIENTE",dep:"CESAR",cod:20026574,ser:"1LCB393900",pot:2500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-AST",sub:"ASTREA",zona:"ORIENTE",dep:"CESAR",cod:20700377,ser:1079537152,pot:10000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-AYAR",sub:"AYAPEL",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056569,ser:200104,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-BDL",sub:"BARRANCO DE LOBA",zona:"ORIENTE",dep:"BOLIVAR",cod:20700350,ser:1057609444,pot:6000,gr:"G1",rt:"ONAN",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1A-A/M-BYC",sub:"BAYUNCA",zona:"BOLIVAR",dep:"BOLIVAR",cod:20016689,ser:"P186144",pot:60000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"34.5",vt:"13.8",uu:"N4T18"},
  {m:"T1-M/M-BEC",sub:"BECERRIL",zona:"ORIENTE",dep:"CESAR",cod:20026669,ser:288055,pot:6500,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-BER",sub:"BERRUGAS",zona:"OCCIDENTE",dep:"SUCRE",cod:20700518,ser:200005,pot:6500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-A/M-BCG",sub:"BOCAGRANDE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20016671,ser:"S251103",pot:33000,gr:"G2",rt:"ONAF",re:"OBSOLETA",reg:"NLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T6"},
  {m:"T2-A/M-BCG",sub:"BOCAGRANDE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20016671,ser:"S251104",pot:33000,gr:"G2",rt:"ONAF",re:"OBSOLETA",reg:"NLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T6"},
  {m:"T1-M/M-BOU",sub:"BOCAS DE URE",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700518,ser:288860,pot:3000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-BOA",sub:"BOSCONIA",zona:"ORIENTE",dep:"CESAR",cod:20026667,ser:1056109597,pot:14000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-A/M-BQE",sub:"BOSQUE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20016679,ser:"S251105",pot:33000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T4"},
  {m:"T2-A/M-BQE",sub:"BOSQUE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20016679,ser:1081983130,pot:40000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T6"},
  {m:"T3-A/M-BQE",sub:"BOSQUE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20016679,ser:"P186142",pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T5"},
  {m:"T4-A/M-BQE",sub:"BOSQUE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20016679,ser:"P185982",pot:150000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:220,vs:"13.8",vt:"N/A",uu:"N5T18"},
  {m:"T1A-A/M-BST",sub:"BOSTON",zona:"OCCIDENTE",dep:"SUCRE",cod:20036683,ser:58982,pot:60000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T18"},
  {m:"T1-M/M-BUE",sub:"BUENAVISTA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056686,ser:181656,pot:5000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1A-A/M-CMR",sub:"CALAMAR",zona:"BOLIVAR",dep:"BOLIVAR",cod:20017565,ser:"84.4.4191",pot:12000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"34.5",vt:"13.8",uu:"N4T14"},
  {m:"T2A-A/M-CMR",sub:"CALAMAR",zona:"BOLIVAR",dep:"BOLIVAR",cod:20017565,ser:1057609450,pot:12000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"34.5",vt:"13.8",uu:"N4T14"},
  {m:"T-KDR04",sub:"CANDELARIA",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700071,ser:316115,pot:100000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:220,vs:110,vt:"N/A",uu:"N5T16"},
  {m:"T-KDR05",sub:"CANDELARIA",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700071,ser:"P186187",pot:150000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:220,vs:110,vt:"N/A",uu:"N5T18"},
  {m:"T-KDR06",sub:"CANDELARIA",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700071,ser:1076935363,pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"13.8",vt:"N/A",uu:"N4T5"},
  {m:"T1-M/M-CNB",sub:"CAÑABRAVAL",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700278,ser:1057609404,pot:2000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-CAZ",sub:"CASA DE ZINC",zona:"ORIENTE",dep:"CESAR",cod:20700518,ser:98330,pot:2000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-CAC",sub:"CASACARA",zona:"ORIENTE",dep:"CESAR",cod:20026783,ser:518711157,pot:5000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-CTA",sub:"CENTRO ALEGRE",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056776,ser:7739,pot:2000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-CER",sub:"CERETE",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056769,ser:1079537174,pot:20000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T5"},
  {m:"T2-M/M-CER",sub:"CERETE",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056769,ser:358516,pot:15000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T3-M/M-CER",sub:"CERETE",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056769,ser:201791,pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"N/A",uu:"N4T5"},
  {m:"T4-M/M-CER",sub:"CERETE",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056769,ser:201790,pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"N/A",uu:"N4T5"},
  {m:"T1-A/M-CMB",sub:"CHAMBACU",zona:"BOLIVAR",dep:"BOLIVAR",cod:20016785,ser:200756,pot:50000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T7"},
  {m:"T2-A/M-CMB",sub:"CHAMBACU",zona:"BOLIVAR",dep:"BOLIVAR",cod:20016785,ser:"P186143",pot:50000,gr:"G3",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T7"},
  {m:"T1-A/M-CPA",sub:"CHINU PLANTA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056780,ser:386780,pot:20000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T5"},
  {m:"T2-A/M-CPA",sub:"CHINU PLANTA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056780,ser:201508,pot:60000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"N/A",uu:"N4T8"},
  {m:"T3-A/M-CPA",sub:"CHINU PLANTA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056780,ser:1056008748,pot:60000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"N/A",uu:"N4T8"},
  {m:"T1-M/M-CHG",sub:"CHIRIGUANA",zona:"ORIENTE",dep:"CESAR",cod:20026771,ser:"N339380",pot:12500,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:"34.5",vs:"14.82",vt:"N/A",uu:"N3T4"},
  {m:"T1-M/M-CIR",sub:"CIENAGA DE ORO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056774,ser:200100,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T2-M/M-CIR",sub:"CIENAGA DE ORO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056774,ser:1057609479,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1A-A/M-COZ",sub:"CODAZZI",zona:"ORIENTE",dep:"CESAR",cod:20026790,ser:"5K0095001",pot:25000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T15"},
  {m:"T2A-A/M-COZ",sub:"CODAZZI",zona:"ORIENTE",dep:"CESAR",cod:20026790,ser:1057474126,pot:25000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T15"},
  {m:"T1-M/M-CBY",sub:"COLOMBOY",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056766,ser:"1LCB393901",pot:2500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-COR",sub:"COROZAL",zona:"OCCIDENTE",dep:"SUCRE",cod:20036782,ser:"N339381",pot:12500,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T2-M/M-COR",sub:"COROZAL",zona:"OCCIDENTE",dep:"SUCRE",cod:20036782,ser:30900117,pot:12500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-A/M-COS",sub:"COSPIQUE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20016779,ser:582568,pot:20000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T4"},
  {m:"T1-M/M-CRR",sub:"COTORRA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700518,ser:"1LCB384963",pot:4000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T2-M/M-CRR",sub:"COTORRA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20057584,ser:1059084098,pot:4000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-COV",sub:"COVEÑAS",zona:"OCCIDENTE",dep:"SUCRE",cod:20037179,ser:"P91036971658",pot:60000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"N/A",uu:"N4T8"},
  {m:"T2-M/M-COV",sub:"COVEÑAS",zona:"OCCIDENTE",dep:"SUCRE",cod:20037179,ser:"P9173532-1309",pot:14000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T3-M/M-COV",sub:"COVEÑAS",zona:"OCCIDENTE",dep:"SUCRE",cod:20037179,ser:1057201703,pot:60000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"N/A",uu:"N4T8"},
  {m:"T1-M/M-CVA",sub:"CUIVA",zona:"OCCIDENTE",dep:"SUCRE",cod:20700443,ser:839,pot:225,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-CUR",sub:"CURUMANÍ",zona:"ORIENTE",dep:"CESAR",cod:20026778,ser:200113,pot:6500,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T2-M/M-CUR",sub:"CURUMANÍ",zona:"ORIENTE",dep:"CESAR",cod:20026778,ser:19750108,pot:4000,gr:"G1",rt:"ONAN",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1A-M/M-EBA",sub:"EL BANCO",zona:"ORIENTE",dep:"MAGDALENA",cod:20026966,ser:1080670133,pot:60000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T18"},
  {m:"T2A-A/M-EBA",sub:"EL BANCO",zona:"ORIENTE",dep:"MAGDALENA",cod:20026966,ser:"P9173521-138102",pot:14000,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-M/M-BTE",sub:"EL BRILLANTE",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700453,ser:78740113,pot:4000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1A-A/M-EBU",sub:"EL BURRO",zona:"ORIENTE",dep:"CESAR",cod:20026985,ser:56190119,pot:3000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1A-A/A-ECA",sub:"EL CARMEN",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700419,ser:1057474108,pot:60000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:66,vt:"13.8",uu:"N4T18"},
  {m:"T2A-A/A-ECA",sub:"EL CARMEN",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700419,ser:1075810620,pot:60000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:66,vt:"13.8",uu:"N4T18"},
  {m:"T1-M/M-ECJ",sub:"EL CORTIJO",zona:"OCCIDENTE",dep:"SUCRE",cod:20036967,ser:506631,pot:25000,gr:"G2",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T6"},
  {m:"T2-M/M-ECJ",sub:"EL CORTIJO",zona:"OCCIDENTE",dep:"SUCRE",cod:20036967,ser:1072462801,pot:25000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T6"},
  {m:"T1-M/M-EDE",sub:"EL DESASTRE",zona:"ORIENTE",dep:"CESAR",cod:20026983,ser:1057609397,pot:2000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-EDF",sub:"EL DIFICIL",zona:"ORIENTE",dep:"MAGDALENA",cod:20026968,ser:55410119,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-PAR",sub:"EL PARAISO",zona:"ORIENTE",dep:"CESAR",cod:20700124,ser:148223,pot:500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T2-M/M-PAR",sub:"EL PARAISO",zona:"ORIENTE",dep:"CESAR",cod:20700124,ser:148224,pot:500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1A-A/M-EPA",sub:"EL PASO",zona:"ORIENTE",dep:"CESAR",cod:20026980,ser:201103,pot:50000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T17"},
  {m:"T1-M/M-EVJ",sub:"EL VIAJANO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20027765,ser:1097131006,pot:2500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-FRR",sub:"FERROCARRIL",zona:"ORIENTE",dep:"CESAR",cod:20700080,ser:"65702-00",pot:1000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-GAL",sub:"GALERAS",zona:"OCCIDENTE",dep:"SUCRE",cod:20700394,ser:200714,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-A/M-GBT",sub:"GAMBOTE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20017166,ser:430659,pot:20000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T4"},
  {m:"T2-A/M-GBT",sub:"GAMBOTE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20017166,ser:1057609449,pot:20000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T4"},
  {m:"T3-A/M-GBT",sub:"GAMBOTE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20017166,ser:10769355362,pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"34.5",vt:"13.8",uu:"N4T14"},
  {m:"T1-M/M-GUM",sub:"GUAMAL",zona:"ORIENTE",dep:"MAGDALENA",cod:20700518,ser:200005,pot:6000,gr:"G1",rt:"ONAF",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-GRA",sub:"GUARANDA",zona:"OCCIDENTE",dep:"SUCRE",cod:20037178,ser:1079537172,pot:12500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-M/M-GUP",sub:"GUATAPURI",zona:"ORIENTE",dep:"CESAR",cod:20027185,ser:"173524-15310",pot:30000,gr:"G2",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T6"},
  {m:"T2-M/M-GUP",sub:"GUATAPURI",zona:"ORIENTE",dep:"CESAR",cod:20027185,ser:200718,pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T6"},
  {m:"T3-M/M-GUP",sub:"GUATAPURI",zona:"ORIENTE",dep:"CESAR",cod:20027185,ser:7740131,pot:7875,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"NLTC",vp:"34.5",vs:"13.2",vt:null,uu:"N3T6"},
  {m:"T1-M/M-HDL",sub:"HATILLO DE LOBA",zona:"ORIENTE",dep:"BOLIVAR",cod:20700333,ser:1079537168,pot:5000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-LPR",sub:"LA APARTADA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20056589,ser:200103,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-LAR",sub:"LA AURORA",zona:"ORIENTE",dep:"CESAR",cod:20027665,ser:51660119,pot:2300,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-LEA",sub:"LA EUROPA",zona:"ORIENTE",dep:"CESAR",cod:20027669,ser:291239,pot:1600,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1A-A/M-LJA",sub:"LA JAGUA",zona:"ORIENTE",dep:"CESAR",cod:20029067,ser:"173523-15510",pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T15"},
  {m:"T2A-A/M-LJA",sub:"LA JAGUA",zona:"ORIENTE",dep:"CESAR",cod:20029067,ser:1054440599,pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T15"},
  {m:"T1A-A/M-LMJ",sub:"LA MOJANA",zona:"OCCIDENTE",dep:"SUCRE",cod:20700411,ser:200719,pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T15"},
  {m:"T1-M/M-LPZ",sub:"LA PAZ",zona:"ORIENTE",dep:"CESAR",cod:20027680,ser:200117,pot:12500,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-M/M-SLV",sub:"LA SALVACION",zona:"ORIENTE",dep:"CESAR",cod:null,ser:1072462802,pot:12500,gr:"G1",rt:"ONAF",re:null,reg:"OLTC",vp:"34.5",vs:"13.8",vt:null,uu:"N3T4"},
  {m:"T1-M/M-UNN",sub:"LA UNION",zona:"OCCIDENTE",dep:"SUCRE",cod:20037685,ser:8681,pot:4000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-LYE",sub:"LA YE",zona:"OCCIDENTE",dep:"CORDOBA",cod:20057689,ser:1057609400,pot:2500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-LDE",sub:"LAS DELICIAS",zona:"OCCIDENTE",dep:"CORDOBA",cod:20057668,ser:1057609396,pot:2500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-LPS",sub:"LAS PALOMAS",zona:"OCCIDENTE",dep:"CORDOBA",cod:20057677,ser:"1LCB375370",pot:1000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-LLC",sub:"LLERASCA",zona:"ORIENTE",dep:"CESAR",cod:20700518,ser:253584,pot:1000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-LBS",sub:"LOMA DEL BALSAMO",zona:"ORIENTE",dep:"MAGDALENA",cod:20027681,ser:55400119,pot:2300,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-LOR",sub:"LORICA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20057679,ser:"P9173529-14510",pot:20000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T5"},
  {m:"T2-M/M-LOR",sub:"LORICA",zona:"OCCIDENTE",dep:"CORDOBA",cod:null,ser:"L30244",pot:20000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T5"},
  {m:"T1-M/M-LCB",sub:"LOS CORDOBAS",zona:"OCCIDENTE",dep:"CORDOBA",cod:20057667,ser:"1LCB393902",pot:2500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1A-A/M-MGE",sub:"MAGANGUE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20047769,ser:"12625/T",pot:33000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T16"},
  {m:"T2A-A/M-MGE",sub:"MAGANGUE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20047769,ser:1076935364,pot:45000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:34.5,vt:"13.8",uu:"N4T17"},
  {m:"T1-M/M-MAJ",sub:"MAJAGUAL",zona:"OCCIDENTE",dep:"SUCRE",cod:20037768,ser:183828,pot:5000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T2-M/M-MAJ",sub:"MAJAGUAL",zona:"OCCIDENTE",dep:"SUCRE",cod:20037768,ser:56220119,pot:5000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-A/M-MAM",sub:"MAMONAL",zona:"BOLIVAR",dep:"BOLIVAR",cod:20017777,ser:"S251979",pot:33000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T6"},
  {m:"T2-A/M-MAM",sub:"MAMONAL",zona:"BOLIVAR",dep:"BOLIVAR",cod:20017777,ser:"S251990",pot:33000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T6"},
  {m:"T1-M/M-MNC",sub:"MANAURE BALCON DEL CESAR",zona:"ORIENTE",dep:"CESAR",cod:20700439,ser:70480113,pot:3000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-MAN",sub:"MANDINGUILLA",zona:"ORIENTE",dep:"CESAR",cod:20027785,ser:393793,pot:10000,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T3-A/M-MZN",sub:"MANZANILLO",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700474,ser:1058585391,pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T5"},
  {m:"T4-A/M-MZN",sub:"MANZANILLO",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700474,ser:1058585425,pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T5"},
  {m:"T1-M/M-MAY",sub:"MARACAYO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20057668,ser:153149,pot:2000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-MBJ",sub:"MARIA LA BAJA",zona:"BOLIVAR",dep:"BOLIVAR",cod:20017774,ser:288054,pot:6500,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T2-M/M-MBJ",sub:"MARIA LA BAJA",zona:"BOLIVAR",dep:"BOLIVAR",cod:20017774,ser:56210119,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-MAR",sub:"MARIANGOLA",zona:"ORIENTE",dep:"CESAR",cod:20027765,ser:1057609398,pot:2500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-MAT",sub:"MATA DE CAÑA",zona:"ORIENTE",dep:"CESAR",cod:20027775,ser:148223,pot:500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T2-M/M-MAT",sub:"MATA DE CAÑA",zona:"ORIENTE",dep:"CESAR",cod:20027775,ser:148222,pot:500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-A/M-MBR",sub:"MEMBRILLAL",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700356,ser:6817,pot:35000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T6"},
  {m:"T2-A/M-MBR",sub:"MEMBRILLAL",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700356,ser:"S251105",pot:33000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T6"},
  {m:"T1-M/M-MOM",sub:"MOMIL",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700452,ser:224024,pot:6250,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1A-A/M-MOX",sub:"MOMPOX",zona:"BOLIVAR",dep:"BOLIVAR",cod:20047780,ser:201266,pot:45000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T17"},
  {m:"T1-M/M-MTB",sub:"MONTELIBANO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20057776,ser:1079537170,pot:15000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T2-M/M-MTB",sub:"MONTELIBANO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20057776,ser:176976,pot:4000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1A-A/M-MON",sub:"MONTERIA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20057784,ser:"LEL27008",pot:40000,gr:"G3",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T16"},
  {m:"T2A-A/M-MON",sub:"MONTERIA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20057784,ser:"LEL27007",pot:40000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T16"},
  {m:"T1-M/M-MTE",sub:"MONTERREY",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700102,ser:"CG2030",pot:2000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-MNT",sub:"MOÑITOS",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700447,ser:1079537162,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-A/M-NCO",sub:"NUEVA COSPIQUE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700025,ser:"A0015275-02",pot:50000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T7"},
  {m:"T2-A/M-NCO",sub:"NUEVA COSPIQUE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700025,ser:"A0015275-01",pot:50000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T7"},
  {m:"T3-A/M-NCO",sub:"NUEVA COSPIQUE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700025,ser:251127,pot:20000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T4"},
  {m:"T4-A/M-NCO",sub:"NUEVA COSPIQUE",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700025,ser:201104,pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T5"},
  {m:"T1-M/M-NGR",sub:"NUEVA GRANADA",zona:"ORIENTE",dep:"MAGDALENA",cod:20700392,ser:1057609443,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-A-M/M-NLLO",sub:"NUEVA LA LOMA",zona:"ORIENTE",dep:"CESAR",cod:20700484,ser:1056436050,pot:50000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T17"},
  {m:"T1A-A/M-NMON",sub:"NUEVA MONTERIA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700465,ser:201789,pot:50000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T17"},
  {m:"T1-M/M-OVE",sub:"OVEJAS",zona:"OCCIDENTE",dep:"SUCRE",cod:20037986,ser:"173488-1156",pot:5000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T2-M/M-OVE",sub:"OVEJAS",zona:"OCCIDENTE",dep:"SUCRE",cod:20037986,ser:55390119,pot:2300,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-PAI",sub:"PAILITAS",zona:"ORIENTE",dep:"CESAR",cod:20028073,ser:1079537166,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-PGU",sub:"PANCEGUITAS",zona:"BOLIVAR",dep:"BOLIVAR",cod:20048071,ser:78750113,pot:5000,gr:"G1",rt:"ONAN",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-A/M-PRC",sub:"PLANETA RICA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058082,ser:30514,pot:50000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T7"},
  {m:"T1-M/M-PZL",sub:"POZO AZUL",zona:"BOLIVAR",dep:"BOLIVAR",cod:20018090,ser:176972,pot:1000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-PRA",sub:"PRADERA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058068,ser:200724,pot:30000,gr:"G2",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T6"},
  {m:"T2-M/M-PRA",sub:"PRADERA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058068,ser:200108,pot:12500,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-M/M-PBN",sub:"PUEBLO NUEVO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058078,ser:173510,pot:4000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-PLO",sub:"PUEBLO NUEVO",zona:"ORIENTE",dep:"MAGDALENA",cod:20028077,ser:266762,pot:6500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-PBD",sub:"PUERTO BADEL",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700135,ser:291240,pot:1600,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-PTE",sub:"PUERTO ESCONDIDO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058069,ser:200713,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-PTL",sub:"PUERTO LIBERTADOR",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058084,ser:200106,pot:6500,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T2-M/M-PTL",sub:"PUERTO LIBERTADOR",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058084,ser:224109,pot:3000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1A-A/M-RSI",sub:"RIO SINU",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058283,ser:"L30515",pot:45000,gr:"G3",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T17"},
  {m:"T2A-A/M-RSI",sub:"RIO SINU",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058283,ser:201259,pot:45000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T17"},
  {m:"T1-M/M-RVJ",sub:"RIO VIEJO",zona:"ORIENTE",dep:"CESAR",cod:20700343,ser:288861,pot:3000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T2-M/M-RVJ",sub:"RIO VIEJO",zona:"ORIENTE",dep:"CESAR",cod:20700343,ser:1058995730,pot:3000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-SHA",sub:"SAHAGUN",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058372,ser:154224,pot:12500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T2-M/M-SHA",sub:"SAHAGUN",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058372,ser:"1LCB393792",pot:12500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-M/M-SGE",sub:"SALGUERO",zona:"ORIENTE",dep:"CESAR",cod:20028369,ser:200723,pot:14000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T2-M/M-SGE",sub:"SALGUERO",zona:"ORIENTE",dep:"CESAR",cod:20028369,ser:"P9173521-13810",pot:14000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T3-M/M-SGE",sub:"SALGUERO",zona:"ORIENTE",dep:"CESAR",cod:20028369,ser:1057609451,pot:14000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-M/M-SAM",sub:"SAMPUES",zona:"OCCIDENTE",dep:"SUCRE",cod:20700437,ser:20050108,pot:5000,gr:"G1",rt:"ONAN",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T2-M/M-SAM",sub:"SAMPUES",zona:"OCCIDENTE",dep:"SUCRE",cod:20700437,ser:"1LCB393903",pot:5000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-SAS",sub:"SAN ANDRES DE SOTAVENTO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700397,ser:20020108,pot:5000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T2-M/M-SAS",sub:"SAN ANDRES DE SOTAVENTO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700397,ser:"1LCB384707",pot:5000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-SAT",sub:"SAN ANTERO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058375,ser:1079537158,pot:15000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-M/M-SBA",sub:"SAN BENITO DE ABAD",zona:"OCCIDENTE",dep:"SUCRE",cod:20700416,ser:27160109,pot:4000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-SBE",sub:"SAN BERNARDO DEL VIENTO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058366,ser:288053,pot:6500,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-SCL",sub:"SAN CARLOS",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700451,ser:1079537156,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-SEO",sub:"SAN ESTANISLAO",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700375,ser:320662,pot:12500,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-M/M-SFE",sub:"SAN FELIPE",zona:"ORIENTE",dep:"MAGDALENA",cod:20028365,ser:10158,pot:2000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1A-A/M-SJA",sub:"SAN JACINTO",zona:"BOLIVAR",dep:"BOLIVAR",cod:20017465,ser:"84.4.4190",pot:8000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"34.5",vt:"13.8",uu:"N4T13"},
  {m:"T2A-A/M-SJA",sub:"SAN JACINTO",zona:"BOLIVAR",dep:"BOLIVAR",cod:20017465,ser:55420119,pot:8000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"34.5",vt:"13.8",uu:"N4T13"},
  {m:"T1-M/M-SJN",sub:"SAN JUAN NEPOMUCENO",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700441,ser:338077,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-SLS",sub:"SAN LUIS",zona:"BOLIVAR",dep:"BOLIVAR",cod:20018390,ser:147862,pot:300,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1A-A/M-SMC",sub:"SAN MARCOS",zona:"OCCIDENTE",dep:"SUCRE",cod:20038378,ser:200025,pot:30000,gr:"G2",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T15"},
  {m:"T1-M/M-SML",sub:"SAN MARTIN DE LOBA",zona:"ORIENTE",dep:"BOLIVAR",cod:20700342,ser:291382,pot:3000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-SOF",sub:"SAN ONOFRE",zona:"OCCIDENTE",dep:"SUCRE",cod:20038379,ser:1079537144,pot:10000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-SPD",sub:"SAN PEDRO",zona:"OCCIDENTE",dep:"SUCRE",cod:20700472,ser:78760113,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-SPY",sub:"SAN PELAYO",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058389,ser:1079537164,pot:15000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-M/M-SRO",sub:"SAN ROQUE",zona:"ORIENTE",dep:"CESAR",cod:20028382,ser:"G6036",pot:1500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-STE",sub:"SANTA ELENA",zona:"ORIENTE",dep:"CESAR",cod:20028381,ser:1079537199,pot:1000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-SAI",sub:"SANTA INES",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700391,ser:21389,pot:4000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-SLC",sub:"SANTA LUCIA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700414,ser:1079537070,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-SRS",sub:"SANTA ROSA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700458,ser:78730113,pot:4000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-SAR",sub:"SANTA ROSA DEL SUR",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700338,ser:32710117,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-STR",sub:"SANTA TERESA",zona:"ORIENTE",dep:"CESAR",cod:20028384,ser:64993953,pot:2000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-ESA",sub:"SENA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058383,ser:224023,pot:3000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1A-A/M-SIE",sub:"SIERRA FLOR",zona:"OCCIDENTE",dep:"SUCRE",cod:20038370,ser:"L30516",pot:60000,gr:"G3",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T18"},
  {m:"T1-M/M-SMN",sub:"SIMAÑA",zona:"ORIENTE",dep:"CESAR",cod:20700079,ser:"1LCB393899",pot:2500,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-SIM",sub:"SIMITI",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700518,ser:200102,pot:6500,gr:"G1",rt:"ONAF",re:"OBSOLETA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1A-A/M-SCE",sub:"SINCE",zona:"OCCIDENTE",dep:"SUCRE",cod:20038367,ser:200026,pot:30000,gr:"G2",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T15"},
  {m:"T1-M/M-SPA",sub:"SINCELEJO PLANTA",zona:"OCCIDENTE",dep:"SUCRE",cod:20038380,ser:200727,pot:15000,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T4"},
  {m:"T1-M/M-SUC",sub:"SUCRE",zona:"OCCIDENTE",dep:"SUCRE",cod:20038385,ser:78710113,pot:4000,gr:"G1",rt:"ONAN",re:"OPERATIVA",reg:"NLTC",vp:30,vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T1-M/M-TLG",sub:"TALAIGUA NUEVO",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700354,ser:200715,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T2-M/M-TLG",sub:"TALAIGUA NUEVO",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700354,ser:"1LCB393905",pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-TAN",sub:"TAMALAMEQUE",zona:"ORIENTE",dep:"CESAR",cod:20028481,ser:1072462800,pot:6500,gr:"G1",rt:"ONAF",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T3A/M-TER",sub:"TERNERA",zona:"BOLIVAR",dep:"BOLIVAR",cod:20018465,ser:"173540-16012",pot:45000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T7"},
  {m:"T1A-A/M-TIE",sub:"TIERRALTA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058482,ser:200031,pot:30000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T15"},
  {m:"T1-M/M-TOL",sub:"TOLU",zona:"OCCIDENTE",dep:"SUCRE",cod:20038479,ser:"P9140576-1458",pot:25000,gr:"G2",rt:"ONAF",re:"OBSOLETA",reg:"OLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T6"},
  {m:"T1A-A/M-TVJ",sub:"TOLU VIEJO",zona:"OCCIDENTE",dep:"SUCRE",cod:20038486,ser:"S251003",pot:60000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:110,vs:"34.5",vt:"13.8",uu:"N4T18"},
  {m:"T1-M/M-TRE",sub:"TRES ESQUINAS",zona:"ORIENTE",dep:"MAGDALENA",cod:20700072,ser:"1LCB384361",pot:2300,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-TPS",sub:"TRES PALMAS",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058480,ser:148234,pot:250,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T2-M/M-TPS",sub:"TRES PALMAS",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058480,ser:148232,pot:250,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T3-M/M-TPS",sub:"TRES PALMAS",zona:"OCCIDENTE",dep:"CORDOBA",cod:20058480,ser:112268,pot:250,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T1"},
  {m:"T1-M/M-VAA",sub:"VALENCIA",zona:"ORIENTE",dep:"CESAR",cod:20028665,ser:1079537104,pot:6500,gr:"G1",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T3"},
  {m:"T1-M/M-VAC",sub:"VALENCIA",zona:"OCCIDENTE",dep:"CORDOBA",cod:20700406,ser:24380109,pot:5000,gr:"G1",rt:"ONAN",re:"OPERATIVA",reg:"NLTC",vp:"34.5",vs:"13.8",vt:"N/A",uu:"N3T2"},
  {m:"T2-A/M-VIE",sub:"VILLA ESTRELLA",zona:"BOLIVAR",dep:"BOLIVAR",cod:20700275,ser:1081030760,pot:50000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T7"},
  {m:"T1A-A/M-ZMB",sub:"ZAMBRANO",zona:"BOLIVAR",dep:"BOLIVAR",cod:20019077,ser:"154212-15812",pot:48000,gr:"G3",rt:"ONAF",re:"OPERATIVA",reg:"NLTC",vp:66,vs:"34.5",vt:"13.8",uu:"N4T17"},
  {m:"T2-A/M-ZMB",sub:"ZAMBRANO",zona:"BOLIVAR",dep:"BOLIVAR",cod:20019077,ser:"HU619715",pot:6000,gr:"G1",rt:"ONAN",re:"N/A",reg:"NLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T2"},
  {m:"T1-A/M-ZRG",sub:"ZARAGOCILLA",zona:"BOLIVAR",dep:"BOLIVAR",cod:20019071,ser:"P911330-15212-1",pot:35000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T6"},
  {m:"T2-A/M-ZRG",sub:"ZARAGOCILLA",zona:"BOLIVAR",dep:"BOLIVAR",cod:20019071,ser:"P9113301-15212-2",pot:35000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T6"},
  {m:"T3-A/M-ZRG",sub:"ZARAGOCILLA",zona:"BOLIVAR",dep:"BOLIVAR",cod:20019071,ser:1057474110,pot:35000,gr:"G2",rt:"ONAF",re:"OPERATIVA",reg:"OLTC",vp:66,vs:"13.8",vt:"N/A",uu:"N4T6"},
];

// ==== CATÁLOGO v6 - 22 ítems del nuevo Consolidado_Suministros_Accesorios_2023 ====
// (código, #ítem, descripción, unidad, valor_unitario, stock_contractual, marca)
const CATALOGO = [
  { cod: "CAT-01",  n:  1, desc: "Suministro de coraza por m",                                unid: "m",   valU:     15120.00, stock:   0, marca: "Por definir" },
  { cod: "CAT-02",  n:  2, desc: "Suministro de Motoventiladores",                            unid: "Und", valU:   5233200.00, stock:  55, marca: "ZIEHL ABEGG" },
  { cod: "CAT-03",  n:  3, desc: "Suministro de radiadores",                                  unid: "Und", valU:  20125000.00, stock:   4, marca: "Por definir" },
  { cod: "CAT-04",  n:  4, desc: "Suministro de bombas de aceite",                            unid: "Und", valU:  42000000.00, stock:   0, marca: "Por definir" },
  { cod: "CAT-05",  n:  5, desc: "Suministro de membran tanque de expansión",                 unid: "Und", valU:  12320000.00, stock:   0, marca: "Por definir" },
  { cod: "CAT-06",  n:  6, desc: "Suministro de cable protecciones mecánicas por m",          unid: "mts", valU:      3899.80, stock:   0, marca: "Por definir" },
  { cod: "CAT-07",  n:  7, desc: "Suministro de transformador de corriente 5A-Imagen térmica",unid: "Und", valU:   2520000.00, stock:   5, marca: "MESSKO" },
  { cod: "CAT-08",  n:  8, desc: "Suministro de Silica Gel por Kg",                           unid: "Kg",  valU:     32590.16, stock: 244, marca: "Por definir" },
  { cod: "CAT-09",  n:  9, desc: "Suministro de recipiente Silica Gel",                       unid: "Und", valU:   3808000.00, stock:  13, marca: "CEDASPE" },
  { cod: "CAT-10",  n: 10, desc: "Suministro de desecador silica autoregenerable",            unid: "Und", valU:  25760000.00, stock:   4, marca: "MESSKO" },
  { cod: "CAT-11",  n: 11, desc: "Suministro de rele de ruptura de membrana",                 unid: "Und", valU:   4480000.00, stock:   0, marca: "Por definir" },
  { cod: "CAT-12",  n: 12, desc: "Suministro de relé de flujo",                               unid: "Und", valU:  34720000.00, stock:   1, marca: "MESSKO" },
  { cod: "CAT-13",  n: 13, desc: "Suministro de indicador de temperatura de aceite",          unid: "Und", valU:  15646684.59, stock:  14, marca: "MESSKO" },
  { cod: "CAT-14",  n: 14, desc: "Suministro de indicador de temperatura devanados",          unid: "Und", valU:  17348945.97, stock:  15, marca: "MESSKO" },
  { cod: "CAT-15",  n: 15, desc: "Suministro de indicador de nivel",                          unid: "Und", valU:  12320000.00, stock:   4, marca: "MESSKO" },
  { cod: "CAT-16",  n: 16, desc: "Suministro de gabinete de control",                         unid: "Und", valU:   2868852.46, stock:   0, marca: "Por definir" },
  { cod: "CAT-17",  n: 17, desc: "Suministro de rele Buchholz",                               unid: "Und", valU:   7000000.00, stock:   9, marca: "CEDASPE" },
  { cod: "CAT-18",  n: 18, desc: "Suministro de válvula de sobrepresión",                     unid: "Und", valU:  12918640.00, stock:   8, marca: "MESSKO" },
  { cod: "CAT-19",  n: 19, desc: "Suministro de junction block",                              unid: "Und", valU:   5040000.00, stock:   0, marca: "Por definir" },
  { cod: "CAT-20",  n: 20, desc: "Suministro de buje 13,8 KV",                                unid: "Und", valU:  11623920.00, stock:   0, marca: "Por definir" },
  { cod: "CAT-21",  n: 21, desc: "Suministro de buje 34,5 KV",                                unid: "Und", valU:  11088000.00, stock:   0, marca: "Por definir" },
  { cod: "CAT-22",  n: 22, desc: "Suministro de buje 66/110 KV",                              unid: "Und", valU:  33687506.89, stock:   3, marca: "TRENCH" },
];
const STOCK_TOTAL = CATALOGO.reduce((s, c) => s + c.stock, 0);
const VALOR_CONTRATO = CATALOGO.reduce((s, c) => s + c.valU * c.stock, 0);

const DESCRIPCIONES = CATALOGO.map(c => c.desc);
const MATRICULAS    = TRANSFORMADORES.map(t => t.m).sort();
const ZONAS         = [...new Set(TRANSFORMADORES.map(t => t.zona))].sort();
const DEPTOS        = [...new Set(TRANSFORMADORES.map(t => t.dep))].sort();
const ANIOS         = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

const STORAGE_KEY = "ctrl_suministros_trafos_v6";

const COLORS = {
  navy: "#0F172A", navyDark: "#1E293B", teal: "#0D9488", orange: "#EA580C",
  red: "#DC2626", green: "#16A34A", blue: "#2563EB", purple: "#7C3AED",
  amber: "#F59E0B", slate500: "#64748B", slate700: "#334155", slate200: "#E2E8F0"
};
const PIE_COLORS = [COLORS.teal, COLORS.orange, COLORS.blue, COLORS.purple, COLORS.red, COLORS.green, COLORS.navy];

function fmtCOP(v) {
  if (v === 0 || v === null || v === undefined || isNaN(v)) return "—";
  return "$" + Math.round(v).toLocaleString('es-CO');
}

function stockState(disp, ini) {
  if (ini === 0)  return { lbl: "⚪ SIN STOCK", color: "bg-slate-100 text-slate-500 border-slate-300" };
  if (disp < 0)   return { lbl: "🔴 NEGATIVO", color: "bg-red-200 text-red-900 border-red-400" };
  if (disp === 0) return { lbl: "⛔ AGOTADO",  color: "bg-red-100 text-red-900 border-red-300" };
  const pct = disp / ini;
  if (pct < 0.2) return { lbl: "🟠 CRÍTICO",  color: "bg-amber-100 text-amber-900 border-amber-300" };
  if (pct < 0.5) return { lbl: "🟡 MEDIO",    color: "bg-yellow-50 text-yellow-900 border-yellow-300" };
  return { lbl: "🟢 OK",       color: "bg-green-50 text-green-900 border-green-300" };
}

export default function ControlMaestro() {
  const [view, setView] = useState('formulario');
  const [form, setForm] = useState({ anio: 2025, desc: '', matricula: '', cantidad: '', obs: '' });
  const [registros, setRegistros] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filtroZona, setFiltroZona] = useState(ZONAS[0]);
  const [filtroDepto, setFiltroDepto] = useState(DEPTOS[0]);
  const [msg, setMsg] = useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r?.value) setRegistros(JSON.parse(r.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);
  React.useEffect(() => {
    if (!loaded) return;
    (async () => {
      try { await window.storage.set(STORAGE_KEY, JSON.stringify(registros)); }
      catch (e) { console.error(e); }
    })();
  }, [registros, loaded]);

  const itemSel = useMemo(() => CATALOGO.find(c => c.desc === form.desc) || null, [form.desc]);
  const txSel   = useMemo(() => TRANSFORMADORES.find(t => t.m === form.matricula) || null, [form.matricula]);
  const valorLinea = useMemo(() => {
    const c = parseInt(form.cantidad) || 0;
    const vu = itemSel?.valU || 0;
    return c * vu;
  }, [form.cantidad, itemSel]);

  const limpiar = () => setForm({ anio: 2025, desc: '', matricula: '', cantidad: '', obs: '' });

  const validar = () => {
    if (!form.anio) return 'Seleccione el año.';
    if (!form.desc) return 'Seleccione la DESCRIPCIÓN del ítem.';
    if (!form.matricula) return 'Seleccione la MATRÍCULA del TX.';
    const c = parseInt(form.cantidad);
    if (!c || c <= 0) return 'Cantidad debe ser entero mayor que 0.';
    if (itemSel && itemSel.stock === 0) return 'Este ítem tiene stock contractual = 0 (revise antes de registrar consumo).';
    return null;
  };

  const guardar = () => {
    const err = validar();
    if (err) { setMsg({ t: 'err', x: err }); return; }
    const tx = TRANSFORMADORES.find(t => t.m === form.matricula);
    const item = CATALOGO.find(c => c.desc === form.desc);
    const cant = parseInt(form.cantidad);
    const nuevo = {
      id: Date.now(),
      anio: parseInt(form.anio),
      desc: form.desc, marca: item?.marca || '—', unid: item?.unid || '—', valU: item?.valU || 0,
      matricula: form.matricula,
      sub: tx?.sub || '—', zona: tx?.zona || '—', dep: tx?.dep || '—',
      cod: tx?.cod || '—', ser: tx?.ser || '—', pot: tx?.pot || '—', gr: tx?.gr || '—',
      rt: tx?.rt || '—', re: tx?.re || '—', reg: tx?.reg || '—',
      vp: tx?.vp || '—', vs: tx?.vs || '—', vt: tx?.vt || '—', uu: tx?.uu || '—',
      cantidad: cant,
      valorTotal: cant * (item?.valU || 0),
      obs: form.obs, ts: new Date().toISOString(),
    };
    setRegistros([nuevo, ...registros]);
    limpiar();
    setMsg({ t: 'ok', x: 'Registro guardado.' });
    setTimeout(() => setMsg(null), 2800);
  };

  const eliminar = (id) => {
    if (confirm('¿Eliminar este registro?')) setRegistros(registros.filter(r => r.id !== id));
  };

  // ==== STOCK con SUMIFS simplificado (solo DESC + ZONA) ====
  const stockTable = useMemo(() => {
    return CATALOGO.map(item => {
      const bol = registros.filter(r => r.desc === item.desc && r.zona === "BOLIVAR").reduce((s, r) => s + r.cantidad, 0);
      const occ = registros.filter(r => r.desc === item.desc && r.zona === "OCCIDENTE").reduce((s, r) => s + r.cantidad, 0);
      const ori = registros.filter(r => r.desc === item.desc && r.zona === "ORIENTE").reduce((s, r) => s + r.cantidad, 0);
      const consumido = bol + occ + ori;
      const disponible = item.stock - consumido;
      const pct = item.stock > 0 ? disponible / item.stock : 0;
      const vConsumido = consumido * item.valU;
      const vDisponible = disponible * item.valU;
      const estado = stockState(disponible, item.stock);
      return { ...item, bol, occ, ori, consumido, disponible, pct, vConsumido, vDisponible, estado };
    });
  }, [registros]);

  const stockKpis = useMemo(() => {
    const agotados = stockTable.filter(x => x.stock > 0 && x.disponible <= 0).length;
    const criticos = stockTable.filter(x => x.disponible > 0 && x.pct < 0.2).length;
    return {
      inicial: STOCK_TOTAL,
      consumido: stockTable.reduce((s, x) => s + x.consumido, 0),
      disponible: stockTable.reduce((s, x) => s + x.disponible, 0),
      agotados, criticos,
      vConsumido: stockTable.reduce((s, x) => s + x.vConsumido, 0),
      vDisponible: stockTable.reduce((s, x) => s + x.vDisponible, 0),
    };
  }, [stockTable]);

  const kpis = useMemo(() => ({
    registros: registros.length,
    unidades: registros.reduce((s, r) => s + r.cantidad, 0),
    descripciones: new Set(registros.map(r => r.desc)).size,
    txAtendidos: new Set(registros.map(r => r.matricula)).size,
    valorConsumido: registros.reduce((s, r) => s + r.valorTotal, 0),
  }), [registros]);

  const rankDesc = useMemo(() => {
    const m = {};
    registros.forEach(r => { m[r.desc] = (m[r.desc] || 0) + r.cantidad; });
    return Object.entries(m).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  }, [registros]);

  const rankDescVal = useMemo(() => {
    const m = {};
    registros.forEach(r => { m[r.desc] = (m[r.desc] || 0) + r.valorTotal; });
    return Object.entries(m).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  }, [registros]);

  const distZona = useMemo(() => {
    const m = {}; ZONAS.forEach(z => { m[z] = 0; });
    registros.forEach(r => { if (m[r.zona] !== undefined) m[r.zona] += r.cantidad; });
    return Object.entries(m).map(([k, v]) => ({ k, v }));
  }, [registros]);

  const distDepto = useMemo(() => {
    const m = {}; DEPTOS.forEach(d => { m[d] = 0; });
    registros.forEach(r => { if (m[r.dep] !== undefined) m[r.dep] += r.cantidad; });
    return Object.entries(m).map(([k, v]) => ({ k, v }));
  }, [registros]);

  const rankZonaDesc = useMemo(() => {
    const m = {}; DESCRIPCIONES.forEach(d => { m[d] = 0; });
    registros.filter(r => r.zona === filtroZona).forEach(r => { m[r.desc] = (m[r.desc] || 0) + r.cantidad; });
    return Object.entries(m).filter(([_, v]) => v > 0).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  }, [registros, filtroZona]);

  const rankDeptoDesc = useMemo(() => {
    const m = {}; DESCRIPCIONES.forEach(d => { m[d] = 0; });
    registros.filter(r => r.dep === filtroDepto).forEach(r => { m[r.desc] = (m[r.desc] || 0) + r.cantidad; });
    return Object.entries(m).filter(([_, v]) => v > 0).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  }, [registros, filtroDepto]);

  const NavBtn = ({ id, label, icon: Icon }) => (
    <button onClick={() => setView(id)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
        view === id ? 'bg-white text-slate-800 shadow-lg' : 'text-slate-200 hover:bg-slate-700'
      }`}>
      <Icon size={16} /> {label}
    </button>
  );

  const Kpi = ({ label, value, bg, Icon, isCurrency = false }) => (
    <div className="rounded-xl p-4 text-white shadow-lg" style={{ background: bg }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider opacity-90">{label}</div>
        <Icon size={18} className="opacity-80" />
      </div>
      <div className={`${isCurrency ? 'text-2xl' : 'text-4xl'} font-black tabular-nums`}>
        {isCurrency ? fmtCOP(value) : value.toLocaleString('es-CO')}
      </div>
    </div>
  );

  const SelectField = ({ label, value, onChange, options, placeholder, required = false, renderOption }) => (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1.5">{label}{required && <span className="text-red-600">*</span>}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:border-slate-600 transition">
        <option value="">{placeholder}</option>
        {options.map((o, i) => {
          const v = typeof o === 'object' ? o.v : o;
          const l = renderOption ? renderOption(o) : (typeof o === 'object' ? o.l : o);
          return <option key={i} value={v}>{l}</option>;
        })}
      </select>
    </div>
  );

  const AutoField = ({ label, value }) => (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1.5">{label} <span className="text-green-700 text-[10px]">(auto)</span></label>
      <div className="w-full px-3 py-2 border-2 border-green-200 rounded-lg bg-green-50 text-sm text-slate-700 font-semibold min-h-[38px] flex items-center">
        {value || <span className="text-slate-400 italic font-normal">—</span>}
      </div>
    </div>
  );

  const ChartCard = ({ title, color, children }) => (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
      <div className="px-5 py-3 text-white font-bold text-sm" style={{ background: color }}>{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );

  // ==== FORMULARIO ====
  const ViewForm = () => (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-xl p-6 md:p-8 border border-slate-200">
        <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-1 flex items-center gap-2">
          <ClipboardList className="text-teal-600" size={24} /> Registro de Suministro
        </h2>
        <p className="text-sm text-slate-500 mb-6">Seleccione la DESCRIPCIÓN (Marca/Unidad/V.Unit autocompletan) y la MATRÍCULA del TX (14 atributos autocompletan).</p>

        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-semibold ${msg.t === 'ok' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
            {msg.x}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <SelectField label="Año" value={form.anio} onChange={v => setForm({ ...form, anio: v })} options={ANIOS} placeholder="— Año —" required />
        </div>

        <div className="bg-teal-50 border-2 border-teal-300 rounded-lg p-4 mb-4">
          <SelectField label="📦 DESCRIPCIÓN (ítem contractual)" value={form.desc}
            onChange={v => setForm({ ...form, desc: v })}
            options={CATALOGO}
            placeholder="— Seleccione un ítem del catálogo —"
            required
            renderOption={(c) => `${c.cod} · ${c.desc}${c.stock === 0 ? ' ⚪' : ''}`} />

          {itemSel && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <AutoField label="Marca" value={itemSel.marca === 'Por definir' ? '' : itemSel.marca} />
              <AutoField label="Unidad" value={itemSel.unid} />
              <AutoField label="Valor Unitario" value={fmtCOP(itemSel.valU)} />
              <AutoField label="Stock contractual" value={`${itemSel.stock} ${itemSel.unid}${itemSel.stock === 0 ? ' ⚪' : ''}`} />
            </div>
          )}
        </div>

        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
          <SelectField label="⚙️ MATRÍCULA DEL TX (llave)" value={form.matricula}
            onChange={v => setForm({ ...form, matricula: v })} options={MATRICULAS}
            placeholder="— Seleccione matrícula —" required />

          {txSel && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <AutoField label="Subestación" value={txSel.sub} />
              <AutoField label="Zona" value={txSel.zona} />
              <AutoField label="Depto" value={txSel.dep} />
              <AutoField label="Código S/E" value={txSel.cod} />
              <AutoField label="Serie" value={txSel.ser} />
              <AutoField label="Potencia (kVA)" value={txSel.pot} />
              <AutoField label="Grupo" value={txSel.gr} />
              <AutoField label="UUCC" value={txSel.uu} />
              <AutoField label="Refrig. Tipo" value={txSel.rt} />
              <AutoField label="Refrig. Estado" value={txSel.re} />
              <AutoField label="Regulación" value={txSel.reg} />
              <AutoField label="V Prim (kV)" value={txSel.vp} />
              <AutoField label="V Sec (kV)" value={txSel.vs} />
              <AutoField label="V Terc (kV)" value={txSel.vt} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Cantidad <span className="text-red-600">*</span></label>
            <input type="number" min="1" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg bg-yellow-50 text-sm font-bold focus:outline-none focus:border-slate-600" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Valor Total línea <span className="text-green-700 text-[10px]">(calc)</span></label>
            <div className="w-full px-3 py-2 border-2 border-green-200 rounded-lg bg-green-50 text-sm font-bold text-slate-800 min-h-[38px] flex items-center">
              {valorLinea > 0 ? fmtCOP(valorLinea) : <span className="text-slate-400 italic font-normal">—</span>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Observaciones</label>
            <input type="text" value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:border-slate-600" />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={guardar} className="flex-1 md:flex-none px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg shadow-md transition">
            GUARDAR REGISTRO
          </button>
          <button onClick={limpiar} className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition">
            LIMPIAR
          </button>
        </div>
      </div>
    </div>
  );

  // ==== VISTA STOCK ====
  const ViewStock = () => (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Stock inicial" value={stockKpis.inicial}    bg={COLORS.navy}   Icon={Box} />
        <Kpi label="Consumido (U)" value={stockKpis.consumido}  bg={COLORS.orange} Icon={TrendingUp} />
        <Kpi label="Disponible (U)" value={stockKpis.disponible} bg={COLORS.teal}   Icon={Package} />
        <Kpi label="Agotados"      value={stockKpis.agotados}   bg={COLORS.red}    Icon={AlertCircle} />
        <Kpi label="Críticos"      value={stockKpis.criticos}   bg={COLORS.amber}  Icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Valor contrato $"    value={VALOR_CONTRATO}       bg={COLORS.slate700} Icon={DollarSign} isCurrency />
        <Kpi label="Valor consumido $"   value={stockKpis.vConsumido} bg={COLORS.orange}   Icon={DollarSign} isCurrency />
        <Kpi label="Valor disponible $"  value={stockKpis.vDisponible}bg={COLORS.teal}     Icon={DollarSign} isCurrency />
      </div>

      <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200">
        <div className="px-5 py-3 text-white font-bold flex items-center gap-2" style={{ background: COLORS.teal }}>
          <Box size={18} /> Control de stock por ítem contractual con información económica
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-2 py-2 text-left">Cód</th>
                <th className="px-2 py-2 text-center">#</th>
                <th className="px-2 py-2 text-left">DESCRIPCIÓN</th>
                <th className="px-2 py-2 text-left">Marca</th>
                <th className="px-2 py-2 text-center">Und</th>
                <th className="px-2 py-2 text-right">V.Unit</th>
                <th className="px-2 py-2 text-right bg-slate-700">Stock Ini.</th>
                <th className="px-2 py-2 text-right">BOL</th>
                <th className="px-2 py-2 text-right">OCC</th>
                <th className="px-2 py-2 text-right">ORI</th>
                <th className="px-2 py-2 text-right bg-orange-700">Cons Tot</th>
                <th className="px-2 py-2 text-right bg-teal-700">Disponible</th>
                <th className="px-2 py-2 text-right bg-orange-700">V.Consumido</th>
                <th className="px-2 py-2 text-right bg-teal-700">V.Disponible</th>
                <th className="px-2 py-2 text-right">% Rest.</th>
                <th className="px-2 py-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {stockTable.map((x, i) => (
                <tr key={x.cod} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-2 py-1.5 font-bold text-teal-700">{x.cod}</td>
                  <td className="px-2 py-1.5 text-center">{x.n}</td>
                  <td className="px-2 py-1.5">{x.desc}</td>
                  <td className={`px-2 py-1.5 ${x.marca === 'Por definir' ? 'italic text-slate-400' : ''}`}>{x.marca}</td>
                  <td className="px-2 py-1.5 text-center">{x.unid}</td>
                  <td className="px-2 py-1.5 text-right">{fmtCOP(x.valU)}</td>
                  <td className={`px-2 py-1.5 text-right font-bold bg-slate-100 ${x.stock === 0 ? 'text-slate-400' : ''}`}>{x.stock}</td>
                  <td className="px-2 py-1.5 text-right">{x.bol || '—'}</td>
                  <td className="px-2 py-1.5 text-right">{x.occ || '—'}</td>
                  <td className="px-2 py-1.5 text-right">{x.ori || '—'}</td>
                  <td className="px-2 py-1.5 text-right font-bold bg-orange-50">{x.consumido || '—'}</td>
                  <td className={`px-2 py-1.5 text-right font-bold ${x.disponible < 0 ? 'bg-red-200 text-red-900' : x.disponible === 0 && x.stock > 0 ? 'bg-red-100 text-red-900' : 'bg-teal-50'}`}>
                    {x.stock === 0 ? '—' : x.disponible}
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold bg-orange-50">{fmtCOP(x.vConsumido)}</td>
                  <td className="px-2 py-1.5 text-right font-bold bg-teal-50">{fmtCOP(x.vDisponible)}</td>
                  <td className="px-2 py-1.5 text-right">{x.stock === 0 ? '—' : (x.pct * 100).toFixed(1) + '%'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${x.estado.color}`}>{x.estado.lbl}</span>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-800 text-white font-bold">
                <td colSpan={6} className="px-2 py-2 text-left">TOTAL</td>
                <td className="px-2 py-2 text-right">{stockKpis.inicial}</td>
                <td className="px-2 py-2 text-right">{stockTable.reduce((s, x) => s + x.bol, 0)}</td>
                <td className="px-2 py-2 text-right">{stockTable.reduce((s, x) => s + x.occ, 0)}</td>
                <td className="px-2 py-2 text-right">{stockTable.reduce((s, x) => s + x.ori, 0)}</td>
                <td className="px-2 py-2 text-right">{stockKpis.consumido}</td>
                <td className="px-2 py-2 text-right">{stockKpis.disponible}</td>
                <td className="px-2 py-2 text-right">{fmtCOP(stockKpis.vConsumido)}</td>
                <td className="px-2 py-2 text-right">{fmtCOP(stockKpis.vDisponible)}</td>
                <td className="px-2 py-2 text-right">{stockKpis.inicial > 0 ? ((stockKpis.disponible / stockKpis.inicial) * 100).toFixed(1) : 0}%</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 text-sm text-slate-600">
        <div className="flex flex-wrap gap-3">
          <span className="inline-block px-2 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-300">⚪ SIN STOCK (contractual = 0)</span>
          <span className="inline-block px-2 py-0.5 rounded border bg-green-50 text-green-900 border-green-300">🟢 OK &gt; 50%</span>
          <span className="inline-block px-2 py-0.5 rounded border bg-yellow-50 text-yellow-900 border-yellow-300">🟡 MEDIO 20-50%</span>
          <span className="inline-block px-2 py-0.5 rounded border bg-amber-100 text-amber-900 border-amber-300">🟠 CRÍTICO &lt; 20%</span>
          <span className="inline-block px-2 py-0.5 rounded border bg-red-100 text-red-900 border-red-300">⛔ AGOTADO</span>
          <span className="inline-block px-2 py-0.5 rounded border bg-red-200 text-red-900 border-red-400">🔴 NEGATIVO</span>
        </div>
      </div>
    </div>
  );

  // ==== DASHBOARD ====
  const ViewDash = () => (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Registros"     value={kpis.registros}      bg={COLORS.navy}    Icon={ClipboardList} />
        <Kpi label="Unidades"      value={kpis.unidades}       bg={COLORS.teal}    Icon={Package} />
        <Kpi label="Descripciones" value={kpis.descripciones}  bg={COLORS.orange}  Icon={Target} />
        <Kpi label="TX atendidos"  value={kpis.txAtendidos}    bg={COLORS.purple}  Icon={Cpu} />
        <Kpi label="Valor consumido $" value={kpis.valorConsumido} bg={COLORS.red} Icon={DollarSign} isCurrency />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Valor contrato"    value={VALOR_CONTRATO}                bg={COLORS.slate700} Icon={DollarSign} isCurrency />
        <Kpi label="Valor consumido"   value={kpis.valorConsumido}           bg={COLORS.orange}   Icon={DollarSign} isCurrency />
        <Kpi label="Valor disponible"  value={VALOR_CONTRATO - kpis.valorConsumido} bg={COLORS.teal} Icon={DollarSign} isCurrency />
        <Kpi label="% Ejecución $"     value={VALOR_CONTRATO > 0 ? parseFloat(((kpis.valorConsumido / VALOR_CONTRATO) * 100).toFixed(2)) : 0} bg={COLORS.blue} Icon={TrendingUp} />
      </div>

      {registros.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-slate-200">
          <AlertTriangle size={42} className="mx-auto text-amber-500 mb-3" />
          <p className="text-slate-600 font-semibold">Aún no hay registros.</p>
          <p className="text-slate-400 text-sm mt-1">Agregue suministros desde el formulario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="Ranking por DESCRIPCIÓN (unidades)" color={COLORS.orange}>
            <ResponsiveContainer width="100%" height={Math.max(260, rankDesc.length * 32)}>
              <BarChart data={rankDesc} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="k" width={240} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="v" fill={COLORS.orange} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Ranking por DESCRIPCIÓN (valor $)" color={COLORS.red}>
            <ResponsiveContainer width="100%" height={Math.max(260, rankDescVal.length * 32)}>
              <BarChart data={rankDescVal} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => (v / 1e6).toFixed(0) + 'M'} />
                <YAxis type="category" dataKey="k" width={240} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v) => fmtCOP(v)} />
                <Bar dataKey="v" fill={COLORS.red} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Distribución por Zona" color={COLORS.teal}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={distZona.filter(x => x.v > 0)} dataKey="v" nameKey="k" cx="50%" cy="50%" outerRadius={100}
                  label={({ k, v }) => `${k}: ${v}`}>
                  {distZona.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Distribución por Departamento" color={COLORS.blue}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distDepto}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="k" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="v" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );

  const ViewCross = () => (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="px-5 py-3 text-white font-bold text-sm flex items-center justify-between" style={{ background: COLORS.teal }}>
          <span>🗺️ Zona × DESCRIPCIÓN</span>
          <select value={filtroZona} onChange={e => setFiltroZona(e.target.value)}
            className="px-3 py-1 rounded text-slate-800 font-bold text-sm">
            {ZONAS.map(z => <option key={z}>{z}</option>)}
          </select>
        </div>
        <div className="p-4">
          {rankZonaDesc.length === 0 ? (
            <p className="text-center text-slate-400 py-6 text-sm">Sin registros para {filtroZona}.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, rankZonaDesc.length * 34)}>
              <BarChart data={rankZonaDesc} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="k" width={240} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="v" fill={COLORS.teal} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="px-5 py-3 text-white font-bold text-sm flex items-center justify-between" style={{ background: COLORS.blue }}>
          <span>🏛️ Departamento × DESCRIPCIÓN</span>
          <select value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)}
            className="px-3 py-1 rounded text-slate-800 font-bold text-sm">
            {DEPTOS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="p-4">
          {rankDeptoDesc.length === 0 ? (
            <p className="text-center text-slate-400 py-6 text-sm">Sin registros para {filtroDepto}.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, rankDeptoDesc.length * 34)}>
              <BarChart data={rankDeptoDesc} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="k" width={240} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="v" fill={COLORS.blue} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );

  const ViewHist = () => (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200">
        <div className="px-5 py-3 text-white font-bold" style={{ background: COLORS.navy }}>
          Histórico ({registros.length} registros · {kpis.unidades.toLocaleString('es-CO')} unidades · {fmtCOP(kpis.valorConsumido)})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-700 text-white">
              <tr>
                <th className="px-2 py-2 text-left">N°</th>
                <th className="px-2 py-2 text-left">Año</th>
                <th className="px-2 py-2 text-left">DESCRIPCIÓN</th>
                <th className="px-2 py-2 text-left">Marca</th>
                <th className="px-2 py-2 text-center">Und</th>
                <th className="px-2 py-2 text-left">Matrícula</th>
                <th className="px-2 py-2 text-left">Subestación</th>
                <th className="px-2 py-2 text-left">Zona</th>
                <th className="px-2 py-2 text-left">Depto</th>
                <th className="px-2 py-2 text-right">Cant.</th>
                <th className="px-2 py-2 text-right">Valor $</th>
                <th className="px-2 py-2 text-center">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-8 text-slate-400">Sin registros.</td></tr>
              ) : registros.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-2 py-1.5 font-bold">{registros.length - i}</td>
                  <td className="px-2 py-1.5">{r.anio}</td>
                  <td className="px-2 py-1.5">{r.desc}</td>
                  <td className={`px-2 py-1.5 ${r.marca === 'Por definir' ? 'italic text-slate-400' : ''}`}>{r.marca}</td>
                  <td className="px-2 py-1.5 text-center">{r.unid}</td>
                  <td className="px-2 py-1.5 font-bold text-amber-700">{r.matricula}</td>
                  <td className="px-2 py-1.5">{r.sub}</td>
                  <td className="px-2 py-1.5">{r.zona}</td>
                  <td className="px-2 py-1.5">{r.dep}</td>
                  <td className="px-2 py-1.5 text-right font-bold">{r.cantidad}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-red-700">{fmtCOP(r.valorTotal)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => eliminar(r.id)} className="text-red-600 hover:text-red-800 font-bold">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const CorrCard = ({ n, tipo, loc, original, nuevo, just }) => (
    <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-slate-100 px-4 py-2 flex items-center justify-between">
        <span className="font-bold text-slate-800 text-sm">#{n} · {tipo}</span>
        <span className="text-xs text-slate-500">{loc}</span>
      </div>
      <div className="p-3 space-y-2 text-sm">
        <div><span className="font-bold text-red-700">Original:</span> <span className="text-slate-700">{original}</span></div>
        <div><span className="font-bold text-green-700">Corregido:</span> <span className="text-slate-800 font-semibold">{nuevo}</span></div>
        <div className="text-xs text-slate-500 italic pt-1 border-t border-slate-100">{just}</div>
      </div>
    </div>
  );

  const ViewCorr = () => (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200">
        <div className="px-5 py-3 text-white font-bold flex items-center gap-2" style={{ background: COLORS.navy }}>
          <FileCheck size={18} /> Trazabilidad de correcciones aplicadas al Consolidado_TX
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
            <p className="text-sm text-slate-700">
              <strong>3 correcciones</strong> autorizadas por el usuario sobre el documento fuente del parque de TX.
            </p>
          </div>
          <CorrCard n={1} tipo="Matrícula duplicada corregida"
            loc="S/E CASA DE ZINC · T1-M/M-CAC → T1-M/M-CAZ"
            original="Dos TX con la misma matrícula (CASA DE ZINC y CASACARA)."
            nuevo="CASA DE ZINC = T1-M/M-CAZ. CASACARA mantiene T1-M/M-CAC."
            just="Usuario aclaró que CASA DE ZINC termina en CAZ." />
          <CorrCard n={2} tipo="Datos de placa completados"
            loc="S/E GUATAPURI · T3-M/M-GUP"
            original="Niveles de tensión vacíos."
            nuevo="V Prim = 34.5 kV · V Sec = 13.2 kV"
            just="Valores aportados por el usuario." />
          <CorrCard n={3} tipo="Datos de placa completados"
            loc="S/E LA SALVACION · T1-M/M-SLV"
            original="Refrigeración, Regulación, Tensiones y UUCC vacíos."
            nuevo="ONAF · OLTC · 34.5 · 13.8 · N3T4"
            just="Valores aportados. Estado de refrigeración pendiente." />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-1">
            <Zap className="text-amber-400" size={28} />
            <div>
              <h1 className="text-xl md:text-2xl font-black">Control Maestro de Suministros</h1>
              <p className="text-xs md:text-sm text-slate-300">
                Contrato 4123000081 · 22 ítems · Stock: {STOCK_TOTAL} U · Valor: {fmtCOP(VALOR_CONTRATO)} · 206 TX
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2 mt-4">
            <NavBtn id="formulario"   label="Registro" icon={ClipboardList} />
            <NavBtn id="stock"        label="Stock" icon={Box} />
            <NavBtn id="dashboard"    label="Dashboard" icon={TrendingUp} />
            <NavBtn id="cruzado"      label="Cruzado" icon={Target} />
            <NavBtn id="historico"    label="Histórico" icon={Package} />
            <NavBtn id="correcciones" label="Correcciones" icon={FileCheck} />
          </nav>
        </div>
      </header>

      <main className="px-4 py-6">
        {view === 'formulario'   && <ViewForm />}
        {view === 'stock'        && <ViewStock />}
        {view === 'dashboard'    && <ViewDash />}
        {view === 'cruzado'      && <ViewCross />}
        {view === 'historico'    && <ViewHist />}
        {view === 'correcciones' && <ViewCorr />}
      </main>

      <footer className="text-center text-xs text-slate-500 py-4">
        Control Maestro v6 · 22 ítems contractuales · 206 TX · Catálogo actualizado al Consolidado_Suministros_Accesorios_2023
      </footer>
    </div>
  );
}
