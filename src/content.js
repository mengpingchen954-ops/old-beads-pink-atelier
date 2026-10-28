export const chapters=[{label:'第一章',title:'重开的小店',sub:'把散落的珠子，重新串成一份心意。'},{label:'第二章',title:'半条旧项链',sub:'两份委托，指向同一段未说完的往事。'},{label:'第三章',title:'把约定戴上',sub:'有些约定，值得换一根新线。'}];
export const customers=[{name:'林晚',role:'修书人',portrait:'customer-lin',bio:'她总在打烊前来，带着旧书与没说完的话。'},{name:'周予',role:'照相馆的学徒',portrait:'customer-zhou',bio:'喜欢把人们没有注意到的细节，留在照片里。'},{name:'许阿婆',role:'街角的老邻居',portrait:'customer-grandma',bio:'她说珠子会记事，只是需要有人听。'}];
export const commissions=[
 {title:'开门的第一束光',client:0,note:'先试一条短手链吧。珠子的颜色，就按这张纸上的顺序。',before:'你擦去柜台的薄灰，门铃响了。林晚把三颗旧珠放在掌心：“听说这间小店，又开门了。”',after:'“很合适。”她抬起手腕，让珠子接住窗边的光。“下回，我带件真正想修的东西来。”',keepsake:'第一位客人',lengths:[3,3],colors:3,railCount:3,capacity:3,seed:2},
 {title:'留一格给后来',client:2,note:'有时先放一放，就能找到藏在后面的那一颗。',before:'许阿婆带来一盒散珠。“不着急，老手艺讲的是先后，不是手快。”',after:'她把新手链装进布袋，顺手留下两块桂花糕。“忙的时候，也别忘了歇一歇。”',keepsake:'桂花糕的香气',lengths:[4,4],colors:3,railCount:3,capacity:2,seed:18},
 {title:'同色，不同去处',client:1,note:'两条手链都要绿幽灵，下一颗需要的颜色却不同。',before:'周予想给照相馆做两份小礼物。“一样的颜色，也可以串出不同的样子，对吧？”',after:'两条手链被摆在旧相机旁。他拍下今天的第一张工坊照片，答应洗好后送回来。',keepsake:'工坊的第一张照片',lengths:[4,5],colors:3,railCount:3,capacity:2,seed:8},
 {title:'窗边的回访',client:0,note:'新的配色里，月光石总会留一点温柔的余地。',before:'林晚戴着上次的手链回来了。她带来的不再是散珠，而是半条褪色的旧项链。',after:'“这只修好的手链，我想留给自己。那半条项链……等我找到另一半，再告诉你。”',keepsake:'半条旧项链',lengths:[5,5],colors:4,railCount:3,capacity:2,seed:32},
 {title:'照片背面的日期',client:1,note:'看完一整根料杆，再决定从哪里开始。',before:'周予送来照片，背面夹着一张旧合影。照片里，两个女孩戴着相同的蓝色珠饰。',after:'“这是奶奶年轻的时候。”他指着照片，“另一个人，她从来没说过是谁。”',keepsake:'旧照 · 夏末',lengths:[5,5],colors:4,railCount:4,capacity:2,seed:91},
 {title:'另一半蓝色',client:2,note:'先串哪一条，会决定你接下来需要什么。',before:'阿婆从手帕里展开另一半项链。“这颗海蓝宝，你能把它配进去吗？旧线断了，珠子还好。”',after:'你把两半项链的照片放在一起。断口严丝合缝，像隔了很多年才接上的一句话。',keepsake:'另一半的来处',lengths:[5,6],colors:5,railCount:4,capacity:2,seed:49},
 {title:'没有寄出的礼物',client:0,note:'暂存格不是废料盒，每一颗都还有它的位置。',before:'林晚说，那条项链是母亲年轻时做的。搬家那天，一份礼物没来得及交到约好的人手里。',after:'“原来不是谁忘了。”她看着重新串起的珠子，轻轻笑了。“只是一直没找到合适的时机。”',keepsake:'迟到的解释',lengths:[6,6],colors:5,railCount:4,capacity:2,seed:123},
 {title:'两份相同的心意',client:1,note:'先打开需要的那一层，不必把眼前的每颗都拿走。',before:'周予想把旧照片重新洗出来，一张送给奶奶，一张放进林晚母亲留下的相册。',after:'镜头前，两条手链放在照片两侧。这一次，他不急着按快门，先等光落在珠子上。',keepsake:'一式两份',lengths:[6,6],colors:6,railCount:4,capacity:2,seed:77},
 {title:'桂花树下的约定',client:2,note:'红玛瑙先露出来时，别急着把它送错地方。',before:'阿婆说起那年桂花树下的约定：“等老了，还要一起去看海。”这次她带来一颗旧木盒里的红玛瑙。',after:'红色落在月光石之间，像桂花树下亮起的一盏小灯。“人不一定都能回来，可心意会找到位置。”',keepsake:'木盒里的红光',lengths:[6,7],colors:7,railCount:4,capacity:2,seed:511},
 {title:'给未来的位置',client:0,note:'颜色多起来以后，每一次暂存都要为下一步留位置。',before:'林晚要去海边。她打算带着母亲的相册，也替阿婆拍一张桂花树以外的风景，并把绿松石留在手腕上。',after:'绿松石和海蓝宝挨在一起，像把一小段海岸线重新串好。',keepsake:'潮汐的颜色',lengths:[7,7],colors:8,railCount:4,capacity:2,seed:623},
 {title:'让故事继续',client:1,note:'烟晶会藏住下一颗，先观察料杆的顺序再动手。',before:'周予在照相馆橱窗挂出工坊的照片。有人看见自己的旧珠子，也看见几颗烟晶里没有洗出的影子。',after:'灰蓝的光没有遮住故事，反而让每颗亮色更清楚。他把最后一张照片递给你：“店里总要有一张自己的故事。”',keepsake:'未洗出的影子',lengths:[7,8],colors:9,railCount:4,capacity:2,seed:734},
 {title:'旧珠，新约',client:2,note:'十种颜色，最后一份委托要把每个选择都看清。',before:'傍晚，三位熟悉的客人一起推开门。阿婆带桂花糕，周予带照片，林晚带回了一小瓶海边的沙。',after:'门铃还会再响，珠子还会重新串起。有些东西旧了，却从没有失去光。谢谢你，让这间小店的故事，有了新的开始。',keepsake:'一小瓶海沙',lengths:[8,8],colors:10,railCount:4,capacity:2,seed:845}
];
