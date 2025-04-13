import module as m

def choice(now,choices,kind):
    return choices[0]

def test_length():
    p = m.Player('test_player')
    i = len(p.hands)
    f = m.Field(players=[p])
    f.draw(player=p, choice=choice)
    assert len(p.hands) == i+1

def test_holder():
    p = m.Player('test_player')
    i = len(p.hands)
    f = m.Field(players=[p])
    f.draw(player=p, choice=choice)
    card = p.hands[0]
    assert p.name == card.player.name