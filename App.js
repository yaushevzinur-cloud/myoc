import React, {useState} from 'react';
import {SafeAreaView,ScrollView,View,Text,TouchableOpacity,StyleSheet,StatusBar} from 'react-native';

const blocks=[
 {time:'07:30',icon:'🌅',title:'Утренний запуск',sub:'Кегель · вес · дневник',done:true},
 {time:'09:00',icon:'🧠',title:'Фокус',sub:'Главная рабочая задача · 90 мин'},
 {time:'11:00',icon:'🇰🇿',title:'Казахский',sub:'Разговорная практика · 20 мин'},
 {time:'13:00',icon:'🍽️',title:'Обед',sub:'Добавить питание'},
 {time:'14:00',icon:'💼',title:'Работа',sub:'Текущие задачи · 120 мин'},
 {time:'18:30',icon:'🏋️',title:'Тренировка',sub:'Вахта · турник + штанга + резинка · 45 мин'},
 {time:'20:30',icon:'📚',title:'Чтение',sub:'25 минут'},
 {time:'22:30',icon:'🌙',title:'Закрыть день',sub:'Итоги · что узнал · план на завтра'}
];
const tabs=['Сегодня','План','＋','Прогресс','Я'];
export default function App(){
 const [mode,setMode]=useState('Вахта'); const [active,setActive]=useState('Сегодня');
 return <SafeAreaView style={s.root}><StatusBar barStyle="light-content"/><ScrollView contentContainerStyle={s.content}>
  <View style={s.header}><View><Text style={s.brand}>MyOS</Text><Text style={s.date}>Пятница · 11 сентября</Text></View><TouchableOpacity style={s.mode} onPress={()=>setMode(mode==='Вахта'?'Дом':'Вахта')}><Text style={s.modeText}>📍 {mode}⌄</Text></TouchableOpacity></View>
  <View style={s.hero}><Text style={s.eyebrow}>МОЙ ДЕНЬ</Text><Text style={s.score}>76%</Text><Text style={s.heroTitle}>Хороший ритм</Text><Text style={s.muted}>3 главных фокуса · 1 тренировка · 20 мин языка</Text></View>
  <Text style={s.section}>🎯 Фокус дня</Text>
  <View style={s.focus}><Text style={s.focusText}>1  💼 Закончить главную рабочую задачу</Text><Text style={s.focusText}>2  🇰🇿 Казахский — разговор</Text><Text style={s.focusText}>3  🏋️ Тренировка на вахте</Text></View>
  <View style={s.ai}><View style={{flex:1}}><Text style={s.aiTitle}>✨ Что мне делать сейчас?</Text><Text style={s.aiText}>Есть 30 минут: лучше 20 мин казахского + 10 мин пройтись.</Text></View><TouchableOpacity style={s.go}><Text style={s.goText}>Начать</Text></TouchableOpacity></View>
  <Text style={s.section}>Ритм дня</Text>
  {blocks.map((b,i)=><TouchableOpacity key={i} style={s.block}><Text style={s.time}>{b.time}</Text><View style={s.dot}><Text>{b.icon}</Text></View><View style={{flex:1}}><Text style={s.blockTitle}>{b.title} {b.done?'✓':''}</Text><Text style={s.blockSub}>{b.sub}</Text></View></TouchableOpacity>)}
  <Text style={s.section}>Сегодня в цифрах</Text><View style={s.metrics}><View><Text style={s.metricN}>1 420</Text><Text style={s.metricL}>из 2 400 ккал</Text></View><View><Text style={s.metricN}>105 г</Text><Text style={s.metricL}>белок / 180</Text></View><View><Text style={s.metricN}>4/6</Text><Text style={s.metricL}>привычки</Text></View></View>
 </ScrollView><View style={s.nav}>{tabs.map(t=><TouchableOpacity key={t} onPress={()=>setActive(t)} style={t==='＋'?s.plus:null}><Text style={[s.navText,active===t&&s.active,t==='＋'&&s.plusText]}>{t}</Text></TouchableOpacity>)}</View></SafeAreaView>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#08111f'},content:{padding:20,paddingBottom:110},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:8},brand:{fontSize:30,fontWeight:'800',color:'#f7f9ff'},date:{color:'#7f8da3',marginTop:3},mode:{backgroundColor:'#152239',paddingVertical:9,paddingHorizontal:12,borderRadius:16},modeText:{color:'#d9e4ff',fontWeight:'700'},hero:{marginTop:22,backgroundColor:'#101d32',borderRadius:25,padding:22},eyebrow:{color:'#6f83a2',fontWeight:'800',fontSize:12},score:{fontSize:48,fontWeight:'900',color:'#eaf1ff',marginTop:4},heroTitle:{fontSize:20,fontWeight:'800',color:'#8ca9ff'},muted:{color:'#7f8da3',marginTop:7},section:{color:'#f1f5ff',fontSize:19,fontWeight:'800',marginTop:25,marginBottom:11},focus:{backgroundColor:'#101a2b',borderRadius:20,padding:16},focusText:{color:'#dce5f7',fontSize:15,marginVertical:6},ai:{flexDirection:'row',alignItems:'center',backgroundColor:'#172348',borderRadius:22,padding:17,marginTop:15},aiTitle:{color:'#f2f5ff',fontWeight:'800',fontSize:16},aiText:{color:'#a7b5cf',marginTop:5,lineHeight:19},go:{backgroundColor:'#e9eeff',paddingVertical:10,paddingHorizontal:14,borderRadius:14,marginLeft:10},goText:{color:'#172348',fontWeight:'900'},block:{flexDirection:'row',alignItems:'center',minHeight:70,borderBottomWidth:1,borderBottomColor:'#142238'},time:{width:50,color:'#71819a',fontWeight:'700'},dot:{width:40,height:40,borderRadius:14,backgroundColor:'#14233b',alignItems:'center',justifyContent:'center',marginRight:12},blockTitle:{color:'#e7edf9',fontWeight:'800',fontSize:16},blockSub:{color:'#71819a',marginTop:4},metrics:{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#101a2b',padding:18,borderRadius:20},metricN:{color:'#eaf0ff',fontWeight:'900',fontSize:18},metricL:{color:'#71819a',fontSize:11,marginTop:3},nav:{position:'absolute',bottom:0,left:0,right:0,height:82,backgroundColor:'#0c1728',borderTopWidth:1,borderTopColor:'#17243a',flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingBottom:12},navText:{color:'#697a95',fontSize:12,fontWeight:'700'},active:{color:'#9cb4ff'},plus:{backgroundColor:'#e9eeff',height:48,width:48,borderRadius:24,alignItems:'center',justifyContent:'center'},plusText:{fontSize:24,color:'#111b2c'}});
