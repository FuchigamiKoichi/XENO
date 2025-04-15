import time

for _ in range(3):
    print(int((time.time()*1000000)%(10**1)*3))