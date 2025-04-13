import module as m

def choice(now,choices,kind):
    return choices[0]

def test_number_player():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    f.draw(player=p,choice=choice)
    f.draw(player=o,choice=choice)
    card = m.Card1(player=p,field=f)
    p.hands.append(card)
    p.hands[0].play(choice=choice)
    assert len(p.hands) == 1

def test_number_object():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    f.draw(player=p,choice=choice)
    f.draw(player=o,choice=choice)
    card = m.Card1(player=p,field=f)
    p.hands.append(card)
    p.hands[0].play(choice=choice)
    assert len(o.hands) == 1

def test_first_time():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    f.draw(player=p,choice=choice)
    f.draw(player=o,choice=choice)
    card = m.Card1(player=p,field=f)
    p.hands.append(card)
    p.hands[0].play(choice=choice)
    assert len(f.played) == 1

def test_second_time():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    f.draw(player=p,choice=choice)
    f.draw(player=o,choice=choice)
    card = m.Card1(player=p,field=f)
    p.hands.append(card)
    p.hands[0].play(choice=choice)
    assert len(f.hands) == 1