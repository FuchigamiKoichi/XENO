import module as m

def choice(now,choices,kind):
    return choices[0]

p = m.Player(name='test_player')
o = m.Player(name='test_object')
f = m.Field(players=[p,o])
card = m.Card1(player=p,field=f)
p.hands.append(card)
p.hands[0].play(choice=choice)
print(p.hands)
print(f.played)